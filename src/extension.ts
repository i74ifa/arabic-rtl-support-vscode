// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import ArabicRTLSupport from "./ArabicRTLSupport";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const arabicRTLSupport = new ArabicRTLSupport();

  // Decorate the currently active editor on startup
  if (vscode.window.activeTextEditor) {
    arabicRTLSupport.decorateArabicText(vscode.window.activeTextEditor);
  }

  let editorWatcher = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) {
      arabicRTLSupport.decorateArabicText(editor);
    }
  });

  let textWatcher = vscode.workspace.onDidChangeTextDocument((event) => {
    if (
      vscode.window.activeTextEditor &&
      event.document === vscode.window.activeTextEditor.document
    ) {
      arabicRTLSupport.decorateArabicText(vscode.window.activeTextEditor);
    }
  });

  let configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("arabicRtlSupport")) {
      arabicRTLSupport.updateDecorationType();
      if (vscode.window.activeTextEditor) {
        arabicRTLSupport.decorateArabicText(vscode.window.activeTextEditor);
      }
    }
  });

  context.subscriptions.push(editorWatcher, textWatcher, configWatcher);
}

// This method is called when your extension is deactivated
export function deactivate() {}
