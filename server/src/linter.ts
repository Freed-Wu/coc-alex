import { Command, Diagnostic, NotificationType } from 'vscode-languageserver';
import { TextDocument, TextEdit } from 'vscode-languageserver-textdocument';
import * as path from 'path';

import { DocumentManager } from './DocumentManager';
import { AlexVSCode } from './alexVSCode';
import { Range } from 'vscode';
import { AlexOptions } from 'alex';
// const { performance } = require('perf_hooks');

// Status notifications
interface StatusParams {
    id: number,
    state: string;
    documents: [
        {
            documentUri: string,
            updatedSource?: string
        }];
    lastFileName?: string
    lastLintTimeMs?: number
}
export const StatusNotificationType = new NotificationType<StatusParams>('alexLinter/status');

// Create commands
const COMMAND_LINT = Command.create('Lint', 'alex-linter.lint');
const COMMAND_LINT_QUICKFIX = Command.create('Quick fix', 'alex-linter.quickFix');
export const commands = [
    COMMAND_LINT,
    COMMAND_LINT_QUICKFIX
];

// Validate a file
export async function executeLinter(textDocument: TextDocument, docManager: DocumentManager, opts: any = { fix: false, format: false }): Promise<TextEdit[]> {
    // const perfStart = performance.now();

    // In case lint was queues, get most recent version of textDocument
    textDocument = docManager.getUpToDateTextDocument(textDocument);

    // Propose to replace tabs by spaces if there are, because CodeNarc hates tabs :/
    const source: string = textDocument.getText();
    const fileNm = path.basename(textDocument.uri);

    // Remove already existing diagnostics except if format
    if (!opts.format) {
        await docManager.resetDiagnostics(textDocument.uri);
    }

    // Get a new task id
    const linterTaskId = docManager.getNewTaskId();

    // Notify client that lint is starting
    // console.log(`Start linting ${ textDocument.uri }`);
    docManager.connection.sendNotification(StatusNotificationType, {
        id: linterTaskId,
        state: 'lint.start' + (opts.fix ? '.fix' : opts.format ? '.format' : ''),
        documents: [{ documentUri: textDocument.uri }],
        lastFileName: fileNm
    });

    // Get settings and stop if action not enabled
    const settings = await docManager.getDocumentSettings(textDocument.uri);
    const linter = new AlexVSCode(settings as AlexOptions);

    // Run alexVSCode linter
    try {
        await linter.run(textDocument);
        if (!opts.format) {
            docManager.setDocLinter(textDocument.uri, linter);
        }
    } catch (e) {
        if (e instanceof Error) {
            // If error, send notification to client
            console.error('VsCode Alex Lint error: ' + e.message + '\n' + e.stack);
        }
        // console.log(`Error linting ${ textDocument.uri }` + e.message + '\n' + e.stack);
        docManager.connection.sendNotification(StatusNotificationType, {
            id: linterTaskId,
            state: 'lint.error',
            documents: [{ documentUri: textDocument.uri }],
            lastFileName: fileNm
        });
        return Promise.resolve([]);
    }
    // console.info(`Completed linting ${ textDocument.uri } in ${ (performance.now() - perfStart).toFixed(0) } ms`);

    // // Parse results
    const lintResults = linter.messages || {};
    const diagnostics: Diagnostic[] = parseLinterResultsIntoDiagnostics(lintResults, source, textDocument, docManager);

    // Send diagnostics to client except if format
    await docManager.updateDiagnostics(textDocument.uri, diagnostics);

    const textEdits: TextEdit[] = [];

    // Just Notify client of end of linting 
    docManager.connection.sendNotification(StatusNotificationType, {
        id: linterTaskId,
        state: 'lint.end',
        documents: [{
            documentUri: textDocument.uri
        }],
        lastFileName: fileNm,
        // lastLintTimeMs: performance.now() - perfStart
    });
    return Promise.resolve(textEdits);
}

// Parse results into VsCode diagnostic
export function parseLinterResultsIntoDiagnostics(lintResults: any, source: string, textDocument: TextDocument, docManager: DocumentManager) {
    const allText = source;

    // Build diagnostics
    const diagnostics: Diagnostic[] = [];
    const docQuickFixes: any = {};
    // console.log(`Parsing results of ${ textDocument.uri }`);
    // Get each error for the file
    lintResults?.forEach((r: { message: { result: string, replace: string[] }; severity: 1 | 2 | 3 | 4 | undefined, range: Range }, i: number) => {
        // Create vscode Diagnostic
        const diagCode: string = 'alexLintError-' + (i + 1);
        const diagnostic: Diagnostic = {
            severity: r.severity,
            code: diagCode,
            range: r.range,
            message: r.message?.result,
            source: 'alexLinter'
        };
        // Add quick fix if error is fixable. This will be reused in CodeActionProvider
        if (r.message?.replace?.length) {
            docQuickFixes[diagCode] = [];
            r.message.replace.forEach((replace, j: number) => {
                docQuickFixes[diagCode].push({
                    label: `Change to \`${ replace }\``,
                    value: replace,
                    errId: 'err.id-' + j
                });
            });
        }

        diagnostics.push(diagnostic);
    });
    docManager.setDocQuickFixes(textDocument.uri, docQuickFixes);
    return diagnostics;
}

