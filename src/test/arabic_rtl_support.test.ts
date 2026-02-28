import * as assert from "assert";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import ArabicRTLSupport from "../ArabicRTLSupport";

suite("ArabicRTLSupport Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  const support = new ArabicRTLSupport();

  // ─── isArabicText ────────────────────────────────────────────────────────────
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

    test("should return false for an empty string", () => {
      assert.strictEqual(support.isArabicText(""), false);
    });

    test("should return true for Arabic text in extended Unicode ranges", () => {
      // U+0750–U+077F: Arabic Supplement
      assert.strictEqual(support.isArabicText("\u0750"), true);
      // U+FB50–U+FDFF: Arabic Presentation Forms-A
      assert.strictEqual(support.isArabicText("\uFB50"), true);
      // U+FE70–U+FEFF: Arabic Presentation Forms-B
      assert.strictEqual(support.isArabicText("\uFE70"), true);
    });
  });

  // ─── updateDecorationType ────────────────────────────────────────────────────
  suite("updateDecorationType", () => {
    test("should not throw when called without a previous decoration", () => {
      const fresh = new ArabicRTLSupport();
      assert.doesNotThrow(() => fresh.updateDecorationType());
    });

    test("should not throw when called multiple times (disposes previous type)", () => {
      assert.doesNotThrow(() => {
        support.updateDecorationType();
        support.updateDecorationType();
      });
    });
  });
});
