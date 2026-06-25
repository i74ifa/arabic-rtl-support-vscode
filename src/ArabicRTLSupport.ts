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
   * للتحقق من وجود أحرف عربية
   */
  public isArabicText(text: string): boolean {
    const arabicRegex =
      /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    return arabicRegex.test(text);
  }

  /**
   * معالجة النصوص العربية داخل الاقتباسات وتطبيق التنسيق
   */
  public decorateArabicText(editor: vscode.TextEditor): void {
    const text = editor.document.getText();
    const ranges: vscode.Range[] = [];

    // ريجيكس للبحث عن النصوص بين " " أو ' ' أو ` ` مع دعم الـ Escaping.
    // المجموعة الملتقطة هي المحتوى الداخلي فقط (بدون علامات الاقتباس).
    const stringRegex =
      /"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|`((?:\\.|[^`\\])*)`/g;

    let match;
    while ((match = stringRegex.exec(text)) !== null) {
      // المحتوى الداخلي فقط — أيّ مجموعة التقطت (مزدوجة/مفردة/خلفية)
      const inner = match[1] ?? match[2] ?? match[3] ?? "";
      // نتحقق إذا كان النص داخل الاقتباس يحتوي على أحرف عربية
      if (inner.length > 0 && this.isArabicText(inner)) {
        // نتجاوز علامة الاقتباس الافتتاحية حتى لا تُنسّق الاقتباسات نفسها
        const innerStart = match.index + 1;
        const startPos = editor.document.positionAt(innerStart);
        const endPos = editor.document.positionAt(innerStart + inner.length);
        ranges.push(new vscode.Range(startPos, endPos));
      }
    }

    editor.setDecorations(this.decorationType, ranges);
  }
}
