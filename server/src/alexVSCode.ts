/*!
 * alex-vscode | MIT (c) Shinnosuke Watanabe
 * https://github.com/shinnn/alex-vscode
*/
'use strict';

import { AlexOptions, text, html, markdown, mdx } from 'alex';
import { TextDocument } from "vscode-languageserver";

export class AlexVSCode {
    private _text: string = '';
    get text() { return this._text; }
    messages: any;
    filetype: string;

    private _settings: AlexOptions;
    get settings(): AlexOptions { return this._settings; }

    constructor (currentSettings: AlexOptions, filetype: string) {
        const profanitySureness = ['unlikely', 'maybe', 'likely'].indexOf(currentSettings?.profanitySureness as unknown as string) as 0 | 1 | 2 | undefined;
        this._settings = {
            ...currentSettings,
            profanitySureness
        };
        this.filetype = filetype;
    }

    isTextDocument(textDocument: TextDocument) {
        if (
            textDocument !== null &&
            typeof textDocument === 'object' &&
            typeof textDocument.getText === 'function'
        ) {
            return true;
        }

        return false;
    }

    run(textDocument: TextDocument) {
        if (!this.isTextDocument(textDocument)) {
            throw new TypeError(
                String(textDocument) +
                ' is not a textDocument. Expected a VS Code\'s textDocument.'
            );
        }

        this._text = textDocument.getText();
        let alex = text;
        if (this.filetype === 'markdown') {
            alex = markdown;
        } else if (this.filetype === 'mdx') {
            alex = mdx;
        } else if (this.filetype === 'html') {
            alex = html;
        }
        let messages = alex(textDocument.getText(), this._settings).messages;
        messages = messages.map((message: any) => ({
            message: this.parseMessage(message.reason),
            // https://github.com/Microsoft/vscode-languageserver-node/blob/v2.6.2/types/src/main.ts#L130-L147
            severity: message.fatal === true ? 1 : 2,
            range: {
                start: {
                    line: (message.location.start.line || message.line || 1) - 1,
                    character: (message.location.start.column || message.column || 1) - 1
                },
                end: {
                    line: (message.location.end.line || message.line || 1) - 1,
                    character: (message.location.end.column || message.column || 1) - 1
                }
            },
            resolved: false
        })) as any[];
        // todo fix type
        this.messages = messages;
        return Promise.resolve([]);
    }

    private parseMessage(message: string): { result: string, replace: string[] } {
        const results = message?.split(', use');
        const replace = this.getOdd(results?.[1]?.split('`'));
        return { result: results?.[0], replace };
    }

    /**
     * @param candid Array of results
     * @return Returns an array where index 0 = array of even ones, and index 1 = array of odd ones
    */
    private getOdd(candid: string[]): string[] {
        const oddOnes: string[] = [];
        for (let i = 0; i < candid?.length; i++) {
            (i % 2 == 0 ? [] : oddOnes).push(candid[i]);
        }
        return oddOnes;
    }
}
