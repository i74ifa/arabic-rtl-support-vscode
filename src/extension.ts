// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import ArabicRTLSupport from "./ArabicRTLSupport";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  let fileWatcher = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) {
      const document = editor.document;

      console.log(new ArabicRTLSupport().findStrings(document));
    }
  });

  context.subscriptions.push(fileWatcher);
}

// This method is called when your extension is deactivated
export function deactivate() {}
