import * as path from 'path';
//# #if HAVE_VSCODE
import { workspace, ExtensionContext } from 'vscode';
import * as vscode from 'vscode';
//# #elif HAVE_COC_NVIM
//# import { workspace, ExtensionContext } from 'coc.nvim';
//# import * as vscode from 'coc.nvim';
//# #endif
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
//# #if HAVE_VSCODE
} from 'vscode-languageclient/node';
//# #elif HAVE_COC_NVIM
//# services,
//# } from 'coc.nvim';
//# #endif

const DIAGNOSTICS_COLLECTION_NAME = 'AlexLinter';
let diagnosticsCollection: vscode.DiagnosticCollection;

let client: LanguageClient;

export function activate(context: ExtensionContext) {
    // Create diagnostics collection
    diagnosticsCollection = vscode.languages.createDiagnosticCollection(DIAGNOSTICS_COLLECTION_NAME);

    ///////////////////////////////////////////////
    /////////////// Server + client ///////////////
    ///////////////////////////////////////////////

    // The server is implemented in node
    //# #if HAVE_VSCODE
    const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
    //# #elif HAVE_COC_NVIM
    //# const serverModule = path.join(__dirname, 'server.js');
    //# #endif
    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: {
                execArgv: ['--nolazy', '--inspect=6009'],
                env: { "DEBUG": "vscode-alex-linter,npm-alex-linter" }
            }
        }
    };
    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        // Register the server for plain text, markdown and latex documents
        documentSelector: [
            { scheme: 'file', language: 'plaintext' },
            { scheme: 'file', language: 'gitcommit' },
            { scheme: 'file', language: 'bbcode' },
            { scheme: 'file', language: 'markdown' },
            { scheme: 'file', language: 'mdx' },
            { scheme: 'file', language: 'html' },
            { scheme: 'file', language: 'latex' }
        ],
        diagnosticCollectionName: DIAGNOSTICS_COLLECTION_NAME,
        progressOnInitialization: true,
        synchronize: {
            // Notify the server about file changes to '.clientrc files contained in the workspace
            fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
        }
    };
    // Create the language client and start the client.
    client = new LanguageClient(
        'alexLinter',
        'Alex Linter',
        serverOptions,
        clientOptions
    );

    // Start the client. This will also launch the server
    context.subscriptions.push(
        //# #if HAVE_VSCODE
        client.start(),
        //# #elif HAVE_COC_NVIM
        //# services.registerLanguageClient(client)
        //# #endif
    );
}

// Stop client when extension is deactivated
//# #if HAVE_VSCODE
export function deactivate(): Thenable<void> {
    return client.stop();
}
//# #endif
