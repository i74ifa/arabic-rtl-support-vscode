import * as ts from "typescript";
import { TextDocument } from "vscode";

export default class ArabicRTLSupport {
  constructor() {}

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

  public findStrings(document: TextDocument): { text: string; line: number }[] {
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
}
