// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import ArabicRTLSupport from "./ArabicRTLSupport";
import { ArabicSearchView } from "./arabicSearchView";

/**
 * يطلب عبارة البحث من المستخدم ثم يعرض النتائج في لوحة RTL المخصّصة.
 * Prompt for an Arabic query and render results in our RTL webview.
 */
async function promptAndSearch(
  view: ArabicSearchView,
  filesToInclude: string,
): Promise<void> {
  const input = await vscode.window.showInputBox({
    prompt: "Search Arabic text (diacritics & hamza/alef variants ignored)",
    placeHolder: "أيفون",
  });

  if (!input) {
    return;
  }

  await view.search(input, filesToInclude);
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const arabicRTLSupport = new ArabicRTLSupport();
  const arabicSearchView = new ArabicSearchView(context);

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

  // البحث عن نص عربي في كامل مساحة العمل مع تجاهل التشكيل وصور الهمزة
  let searchWorkspace = vscode.commands.registerCommand(
    "arabicRtlSupport.searchArabicInWorkspace",
    () => promptAndSearch(arabicSearchView, ""),
  );

  // البحث في الملف النشط فقط
  let searchActiveFile = vscode.commands.registerCommand(
    "arabicRtlSupport.searchArabicInActiveFile",
    () => {
      const uri = vscode.window.activeTextEditor?.document.uri;
      promptAndSearch(
        arabicSearchView,
        uri ? vscode.workspace.asRelativePath(uri) : "",
      );
    },
  );

  // زر في شريط الحالة لتشغيل البحث العربي (متجاهل التشكيل) بنقرة واحدة
  let searchStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  searchStatusBarItem.text = "$(search) أ";
  searchStatusBarItem.tooltip =
    "Search Arabic text (diacritics & hamza/alef variants ignored)";
  searchStatusBarItem.command = "arabicRtlSupport.searchArabicInWorkspace";
  searchStatusBarItem.show();

  context.subscriptions.push(
    editorWatcher,
    textWatcher,
    configWatcher,
    searchWorkspace,
    searchActiveFile,
    searchStatusBarItem,
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
