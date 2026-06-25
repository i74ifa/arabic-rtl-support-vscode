import * as assert from "assert";

import * as vscode from "vscode";
import { toDiacriticInsensitiveRegex } from "../arabicSearch";

/** Helper: does the regex produced for `query` match `text` anywhere? */
function matches(query: string, text: string): boolean {
  return new RegExp(toDiacriticInsensitiveRegex(query)).test(text);
}

suite("Arabic Search Test Suite", () => {
  vscode.window.showInformationMessage("Start Arabic search tests.");

  // ─── toDiacriticInsensitiveRegex: matching behaviour ──────────────────────────
  suite("toDiacriticInsensitiveRegex — matching", () => {
    test("matches the exact query", () => {
      assert.ok(matches("أيفون", "أيفون"));
    });

    test("ignores hamza/alef variants on the same base letter", () => {
      // query "أيفون" should match every alef/hamza spelling
      assert.ok(matches("أيفون", "آيفون"));
      assert.ok(matches("أيفون", "ايفون"));
      assert.ok(matches("أيفون", "إيفون"));
      assert.ok(matches("أيفون", "ٱيفون"));
    });

    test("ignores diacritics (harakat) present in the target text", () => {
      assert.ok(matches("أيفون", "أَيْفُون"));
      assert.ok(matches("محمد", "مُحَمَّد"));
    });

    test("ignores diacritics present in the query itself", () => {
      assert.ok(matches("مُحَمَّد", "محمد"));
      assert.ok(matches("مُحَمَّد", "مُحَمَّد"));
    });

    test("ignores tatweel/kashida in the target text", () => {
      assert.ok(matches("محمد", "محـمـد"));
    });

    test("treats waw forms as equivalent", () => {
      assert.ok(matches("نور", "نؤر"));
    });

    test("treats ya forms (ya / alef maqsura) as equivalent", () => {
      assert.ok(matches("علي", "على"));
      assert.ok(matches("علي", "علئ"));
    });

    test("treats ta-marbuta and ha as equivalent", () => {
      assert.ok(matches("مدرسة", "مدرسه"));
      assert.ok(matches("مدرسه", "مدرسة"));
    });

    test("treats kaf and keheh as equivalent", () => {
      assert.ok(matches("كتاب", "کتاب"));
    });

    test("matches an Arabic substring inside a larger string", () => {
      assert.ok(matches("أيفون", "سعر الآيفون اليوم"));
    });

    test("does not match an unrelated Arabic word", () => {
      assert.ok(!matches("أيفون", "سامسونج"));
    });
  });

  // ─── toDiacriticInsensitiveRegex: produced pattern ────────────────────────────
  suite("toDiacriticInsensitiveRegex — produced pattern", () => {
    test("returns an empty string for an empty query", () => {
      assert.strictEqual(toDiacriticInsensitiveRegex(""), "");
    });

    test("strips diacritics so they never appear as literals in the pattern", () => {
      const pattern = toDiacriticInsensitiveRegex("مُحَمَّد");
      assert.ok(!/[ً-ٰٟ]/.test(pattern));
    });

    test("escapes regex metacharacters in non-Arabic input", () => {
      const pattern = toDiacriticInsensitiveRegex("a.b");
      // the dot must be escaped, so "axb" should NOT match
      assert.ok(!new RegExp(`^${pattern}$`).test("axb"));
      assert.ok(new RegExp(`^${pattern}$`).test("a.b"));
    });

    test("produces a regex that is always valid (no syntax errors)", () => {
      assert.doesNotThrow(() => new RegExp(toDiacriticInsensitiveRegex("(test) [a]*+?")));
      assert.doesNotThrow(() => new RegExp(toDiacriticInsensitiveRegex("أيفون 12$")));
    });

    test("expands an equivalence-class letter into a character class", () => {
      const pattern = toDiacriticInsensitiveRegex("ا");
      assert.ok(pattern.includes("[اأإآٱء]"));
    });
  });
});
