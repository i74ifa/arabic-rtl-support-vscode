import * as vscode from "vscode";
import { toDiacriticInsensitiveRegex } from "./arabicSearch";

/**
 * نتيجة بحث واحدة داخل سطر معيّن.
 * A single match inside one line of a file.
 */
interface LineMatch {
  /** 0-based line number. */
  line: number;
  /** Column where the match starts (UTF-16 code-unit offset). */
  startCol: number;
  /** Column where the match ends. */
  endCol: number;
  /** The full text of the line (trimmed of trailing whitespace). */
  text: string;
}

/** All matches found in a single file. */
interface FileResult {
  uri: vscode.Uri;
  /** Workspace-relative path, shown as the group header. */
  relativePath: string;
  matches: LineMatch[];
}

/**
 * مجلدات وملفات تُستثنى افتراضياً من البحث.
 * Default things we never want to scan.
 */
const DEFAULT_EXCLUDE =
  "{**/node_modules/**,**/.git/**,**/dist/**,**/out/**,**/.next/**,**/vendor/**,**/*.min.*,**/*.map}";

/** Don't scan files larger than this (bytes) — avoids huge generated blobs. */
const MAX_FILE_SIZE = 2 * 1024 * 1024;

/** Cap total matches so a broad query can't lock up the UI. */
const MAX_MATCHES = 2000;

/**
 * لوحة عرض نتائج البحث العربي مع دعم كامل لاتجاه RTL.
 *
 * VS Code's built-in Search panel splits each result line into separate
 * spans (before / match / after), which breaks the Unicode bidi algorithm and
 * scrambles Arabic. Extensions cannot restyle that panel, so we render results
 * in a webview we fully control, where each line flows as one RTL-aware run.
 */
export class ArabicSearchView {
  private panel: vscode.WebviewPanel | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * تنفيذ البحث وعرض النتائج في اللوحة.
   * Run the search and (re)show the results panel.
   *
   * @param rawQuery the user's plain Arabic query (not yet a regex).
   * @param filesToInclude "" for the whole workspace, or a relative path/glob.
   */
  public async search(rawQuery: string, filesToInclude: string): Promise<void> {
    const pattern = toDiacriticInsensitiveRegex(rawQuery);
    const results = await this.runSearch(pattern, filesToInclude);

    this.ensurePanel();
    this.panel!.webview.html = this.renderHtml(rawQuery, results);
    this.panel!.reveal(vscode.ViewColumn.Active, true);
  }

  /** فتح اللوحة أو إعادة استخدامها إن كانت موجودة. */
  private ensurePanel(): void {
    if (this.panel) {
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "arabicRtlSupport.searchResults",
      "نتائج البحث العربي",
      { viewColumn: vscode.ViewColumn.Active, preserveFocus: true },
      { enableScripts: true, retainContextWhenHidden: true },
    );

    this.panel.onDidDispose(
      () => {
        this.panel = undefined;
      },
      null,
      this.context.subscriptions,
    );

    // فتح الملف عند نقر النتيجة
    this.panel.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg),
      null,
      this.context.subscriptions,
    );
  }

  /** فتح الملف على موضع النتيجة المختارة. */
  private async handleMessage(msg: {
    type?: string;
    uri?: string;
    line?: number;
    startCol?: number;
    endCol?: number;
  }): Promise<void> {
    if (msg.type !== "open" || !msg.uri) {
      return;
    }

    const uri = vscode.Uri.parse(msg.uri);
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.One,
      preview: true,
    });

    const line = msg.line ?? 0;
    const range = new vscode.Range(
      line,
      msg.startCol ?? 0,
      line,
      msg.endCol ?? 0,
    );
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
  }

  /**
   * البحث الفعلي: جلب الملفات، قراءتها، ومطابقة الريجيكس سطراً بسطر.
   * Do the actual searching ourselves so we own the rendering.
   */
  private async runSearch(
    pattern: string,
    filesToInclude: string,
  ): Promise<FileResult[]> {
    const include = filesToInclude || "**/*";
    const files = await vscode.workspace.findFiles(include, DEFAULT_EXCLUDE);

    const decoder = new TextDecoder("utf-8", { fatal: false });
    const results: FileResult[] = [];
    let total = 0;

    for (const uri of files) {
      if (total >= MAX_MATCHES) {
        break;
      }

      let bytes: Uint8Array;
      try {
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.size > MAX_FILE_SIZE) {
          continue;
        }
        bytes = await vscode.workspace.fs.readFile(uri);
      } catch {
        continue;
      }

      // تخطّي الملفات الثنائية (تحتوي على بايت صفري)
      if (bytes.includes(0)) {
        continue;
      }

      const content = decoder.decode(bytes);
      const matches = this.matchInContent(content, pattern, MAX_MATCHES - total);
      if (matches.length > 0) {
        total += matches.length;
        results.push({
          uri,
          relativePath: vscode.workspace.asRelativePath(uri),
          matches,
        });
      }
    }

    return results;
  }

  /** مطابقة الريجيكس على كل سطر وإرجاع المواضع. */
  private matchInContent(
    content: string,
    pattern: string,
    limit: number,
  ): LineMatch[] {
    const matches: LineMatch[] = [];
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length && matches.length < limit; i++) {
      const line = lines[i];
      // ريجيكس جديد لكل سطر لإعادة ضبط lastIndex بأمان
      const re = new RegExp(pattern, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(line)) !== null && matches.length < limit) {
        matches.push({
          line: i,
          startCol: m.index,
          endCol: m.index + m[0].length,
          text: line.replace(/\s+$/, ""),
        });
        // حماية من المطابقات الصفرية الطول
        if (m.index === re.lastIndex) {
          re.lastIndex++;
        }
      }
    }

    return matches;
  }

  /** بناء صفحة HTML للويب-فيو مع اتجاه RTL سليم. */
  private renderHtml(rawQuery: string, results: FileResult[]): string {
    const nonce = makeNonce();
    const fileCount = results.length;
    const matchCount = results.reduce((n, r) => n + r.matches.length, 0);

    const body = results.length
      ? results.map((r) => this.renderFile(r)).join("")
      : `<p class="empty">لا توجد نتائج للبحث عن «${escapeHtml(rawQuery)}»</p>`;

    const summary = results.length
      ? `${matchCount} نتيجة في ${fileCount} ملف`
      : "";

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    padding: 8px 12px;
  }
  .header {
    position: sticky;
    top: 0;
    background: var(--vscode-editor-background);
    padding: 6px 0 10px;
    border-bottom: 1px solid var(--vscode-panel-border);
    margin-bottom: 8px;
  }
  .header .query { font-weight: 600; }
  .header .summary { opacity: 0.7; font-size: 0.9em; }
  .file { margin-bottom: 14px; }
  .file-path {
    color: var(--vscode-textLink-foreground);
    font-size: 0.9em;
    opacity: 0.85;
    margin-bottom: 4px;
    word-break: break-all;
    direction: ltr;
    text-align: left;
  }
  .match-line {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 2px 6px;
    border-radius: 4px;
    cursor: pointer;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .match-line:hover { background: var(--vscode-list-hoverBackground); }
  .ln {
    flex: 0 0 auto;
    min-width: 3ch;
    text-align: left;
    direction: ltr;
    opacity: 0.5;
    font-variant-numeric: tabular-nums;
    user-select: none;
  }
  /* The line content flows as ONE run with auto direction so the bidi
     algorithm sees the whole string — the highlight is just a background,
     it does not isolate (which is what scrambled the built-in panel). */
  .code {
    flex: 1 1 auto;
    unicode-bidi: plaintext;
    font-family: var(--vscode-editor-font-family, monospace);
  }
  .hl {
    background: var(--vscode-editor-findMatchHighlightBackground, rgba(234,92,0,0.33));
    color: var(--vscode-foreground);
    border-radius: 2px;
  }
  .empty { opacity: 0.7; padding: 20px 0; }
</style>
</head>
<body>
  <div class="header">
    <div class="query">🔎 ${escapeHtml(rawQuery)}</div>
    <div class="summary">${summary}</div>
  </div>
  ${body}
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('.match-line').forEach((el) => {
      el.addEventListener('click', () => {
        vscode.postMessage({
          type: 'open',
          uri: el.dataset.uri,
          line: Number(el.dataset.line),
          startCol: Number(el.dataset.start),
          endCol: Number(el.dataset.end),
        });
      });
    });
  </script>
</body>
</html>`;
  }

  /** بناء مجموعة نتائج ملف واحد. */
  private renderFile(result: FileResult): string {
    const uriAttr = escapeHtml(result.uri.toString());
    const rows = result.matches
      .map((m) => {
        const html = highlightLine(m.text, m.startCol, m.endCol);
        return `<div class="match-line" data-uri="${uriAttr}" data-line="${m.line}" data-start="${m.startCol}" data-end="${m.endCol}">
          <span class="ln">${m.line + 1}</span>
          <span class="code" dir="auto">${html}</span>
        </div>`;
      })
      .join("");

    return `<div class="file">
      <div class="file-path">${escapeHtml(result.relativePath)}</div>
      ${rows}
    </div>`;
  }
}

/**
 * إبراز جزء المطابقة داخل السطر مع تهريب HTML.
 * Wrap the matched span in a highlight while escaping everything for HTML.
 */
function highlightLine(text: string, start: number, end: number): string {
  const before = escapeHtml(text.slice(0, start));
  const match = escapeHtml(text.slice(start, end));
  const after = escapeHtml(text.slice(end));
  return `${before}<span class="hl">${match}</span>${after}`;
}

/** تهريب الرموز الخاصة بـ HTML. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** توليد nonce لسياسة أمان المحتوى (CSP). */
function makeNonce(): string {
  let text = "";
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
