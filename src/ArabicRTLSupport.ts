import * as ts from "typescript";
import * as vscode from "vscode";

export default class ArabicRTLSupport {
  private decorationType!: vscode.TextEditorDecorationType;

  constructor() {
    this.updateDecorationType();
  }

  public updateDecorationType(): void {
    if (this.decorationType) {
      this.decorationType.dispose();
    }

    const config = vscode.workspace.getConfiguration("arabicRtlSupport");
    const enableBackground = config.get<boolean>("enableBackground", true);
    const backgroundColor = config.get<string>("backgroundColor", "#ffffff");
    const backgroundOpacity = config.get<number>("backgroundOpacity", 0.05);
    const textColor = config.get<string>("textColor", "");

    let bgColor = "transparent";
    if (enableBackground) {
      const hexMatch = backgroundColor.match(
        /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i,
      );
      if (hexMatch) {
        const r = parseInt(hexMatch[1], 16);
        const g = parseInt(hexMatch[2], 16);
        const b = parseInt(hexMatch[3], 16);
        bgColor = `rgba(${r}, ${g}, ${b}, ${backgroundOpacity})`;
      } else {
        bgColor = backgroundColor;
      }
    }

    this.decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: enableBackground ? bgColor : undefined,
      color: textColor ? textColor : undefined,
      textDecoration: "none; direction: rtl; unicode-bidi: isolate;",
    });
  }

  /**
   * Checks if the given text contains any Arabic characters.
   * @param text The text to check.
   * @returns boolean True if the text contains Arabic characters, false otherwise.
   */
  public isArabicText(text: string): boolean {
    const arabicRegex =
      /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    return arabicRegex.test(text);
  }

  /**
   * Extracts text strings enclosed in quotes (single, double, or backticks) from a given string/code.
   * For example, given 'print("this is text")', it will return ['this is text'].
   * @param code The code containing text literals.
   * @returns string[] An array of extracted text strings without the surrounding quotes.
   */
  public extractTextFromCode(code: string): string[] {
    // Matches sequences inside double quotes, single quotes, or backticks, ignoring escaped quotes
    const stringLiteralRegex =
      /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g;
    const matches = code.match(stringLiteralRegex);

    if (!matches) {
      return [];
    }

    // Remove the surrounding quotes from each match and return the inner text
    return matches.map((match) => match.slice(1, -1));
  }

  /**
   * Finds Arabic strings in the document and returns their text and line numbers.
   */
  public findStrings(
    document: vscode.TextDocument,
  ): { text: string; line: number }[] {
    const sourceFile = ts.createSourceFile(
      "file.ts",
      document.getText(),
      ts.ScriptTarget.Latest,
      true,
    );

    const results: { text: string; line: number }[] = [];

    const visit = (node: ts.Node) => {
      if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node)
      ) {
        if (this.isArabicText(node.text)) {
          const line = document.positionAt(node.getStart()).line;
          results.push({ text: node.text, line });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return results;
  }

  /**
   * Decorates Arabic text in the editor.
   */
  public decorateArabicText(editor: vscode.TextEditor): void {
    const document = editor.document;
    const sourceFile = ts.createSourceFile(
      "file.ts",
      document.getText(),
      ts.ScriptTarget.Latest,
      true,
    );

    const ranges: vscode.Range[] = [];

    const visit = (node: ts.Node) => {
      if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node)
      ) {
        if (this.isArabicText(node.text)) {
          const startPos = document.positionAt(node.getStart());
          const endPos = document.positionAt(node.getEnd());
          ranges.push(new vscode.Range(startPos, endPos));
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    editor.setDecorations(this.decorationType, ranges);
  }
}
