import * as assert from "assert";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import ArabicRTLSupport from "../ArabicRTLSupport";

suite("ArabicRTLSupport Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  const support = new ArabicRTLSupport();

  suite("isArabicText", () => {
    test("should return true for purely Arabic text", () => {
      assert.strictEqual(support.isArabicText("مرحبا"), true);
      assert.strictEqual(support.isArabicText("تجربة نص عربي"), true);
    });

    test("should return false for purely English/Latin text", () => {
      assert.strictEqual(support.isArabicText("Hello Worldwide"), false);
      assert.strictEqual(support.isArabicText("test string"), false);
    });

    test("should return true for mixed text containing Arabic", () => {
      assert.strictEqual(support.isArabicText("Hello مرحبا"), true);
      assert.strictEqual(support.isArabicText("123456 تجربة"), true);
    });

    test("should return false for numbers and symbols only", () => {
      assert.strictEqual(support.isArabicText("123456"), false);
      assert.strictEqual(support.isArabicText("!@#$%^&*()"), false);
    });
  });

  suite("extractTextFromCode", () => {
    test("should extract text from double quotes", () => {
      const result = support.extractTextFromCode('print("hello world")');
      assert.deepStrictEqual(result, ["hello world"]);
    });

    test("should extract text from single quotes", () => {
      const result = support.extractTextFromCode("let a = 'some text';");
      assert.deepStrictEqual(result, ["some text"]);
    });

    test("should extract text from backticks", () => {
      const result = support.extractTextFromCode(
        "console.log(`template literal`);",
      );
      assert.deepStrictEqual(result, ["template literal"]);
    });

    test("should extract multiple string literals from code", () => {
      const result = support.extractTextFromCode(
        "print(\"hello\"); const s = 'world';",
      );
      assert.deepStrictEqual(result, ["hello", "world"]);
    });

    test("should handle empty strings correctly", () => {
      const result = support.extractTextFromCode('let empty = "";');
      assert.deepStrictEqual(result, [""]);
    });

    test("should return an empty array if no text is found", () => {
      const result = support.extractTextFromCode(
        "const a = 1; const b = 2; return a + b;",
      );
      assert.deepStrictEqual(result, []);
    });

    test("should handle escaped quotes inside strings", () => {
      const result = support.extractTextFromCode(
        'const str = "escaping \\" inside";',
      );
      assert.deepStrictEqual(result, ['escaping \\" inside']);
    });
  });
});
