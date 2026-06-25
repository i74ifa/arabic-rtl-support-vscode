# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

VS Code extension (`i74ifa.arabic-rtl-support`) that detects Arabic text in the editor and renders it right-to-left, plus diacritic-insensitive Arabic search commands. Authored in TypeScript; UI strings, comments, and the README are largely in Arabic.

## Commands

```bash
bun run compile      # tsc -p ./  → emits out/
bun run watch        # tsc -watch; run this before debugging/tests so output is fresh
bun run lint         # eslint src
bun run test         # vscode-test (runs pretest: compile + lint first)
```

- **Debug/run the extension:** press `F5` to launch an Extension Development Host with the extension loaded.
- **Tests** are compiled from `src/test/**/*.test.ts` to `out/test/**/*.test.js`, then discovered by `.vscode-test.mjs`. There is no single-test script — narrow with Mocha `.only` or `--grep` via the Testing view / `@vscode/test-cli`.

## Build output gotcha

There are **two** build targets and they disagree:
- `tsc` (`compile`/`watch`) emits unbundled JS to `out/` — this is what `main` (`./out/extension.js`) and the test runner use during development.
- `vscode:prepublish` runs **esbuild** to bundle a minified `dist/extension.js`.

When packaging/publishing, `main` must point at the bundled artifact or VS Code will load the wrong file. Keep this in mind if you touch the build scripts or `main`.

## Package manager

This repo uses **bun** (`bun.lock`). Run scripts with `bun run <script>` and install with `bun install`.

## Architecture

Entry point is `src/extension.ts` → `activate()`, fired on `onStartupFinished`. It wires three concerns:

1. **RTL decoration** (`src/ArabicRTLSupport.ts`) — the core class.
   - `decorateArabicText(editor)` scans the whole document with a **string-literal regex** (matches `"..."`, `'...'`, `` `...` `` with escape support), and only decorates spans that contain Arabic. So Arabic in comments/identifiers is *not* decorated — only inside quotes.
   - The decoration applies `direction: rtl; unicode-bidi: isolate;` via the `textDecoration` field plus an optional translucent background.
   - `updateDecorationType()` rebuilds the `TextEditorDecorationType` from `arabicRtlSupport.*` config; it disposes the previous type each time (important — call it on config change, not per-decorate).
   - Re-decoration is driven by three watchers in `activate()`: active-editor change, text-document change, and configuration change.

2. **Diacritic-insensitive search** (`src/arabicSearch.ts`).
   - `toDiacriticInsensitiveRegex(query)` strips harakat/tatweel from the query, maps each base letter to an **equivalence class** (alef/hamza forms, waw, ya, ta-marbuta/ha, kaf variants all collapse together), and inserts an optional diacritics run after every letter — so `أيفون` matches `آيفون`, `ايفون`, `أَيْفُون`, etc.
   - `searchArabicNormalized(filesToInclude)` prompts for input and opens VS Code's `workbench.action.findInFiles` with `isRegex: true`. Two commands call it: `searchArabicInWorkspace` (empty scope) and `searchArabicInActiveFile` (active file's relative path).
   - A status-bar item (`$(search) أ`, bottom-right) triggers the workspace search — the built-in Search input toolbar (Aa / ab| / .*) is not extensible by third-party extensions, so the status bar is the chosen surface.

## Adding things

- **New command:** register in `contributes.commands` in `package.json` (use the `arabicRtlSupport.*` prefix and the `Arabic RTL Support` category) AND register the handler + push to `context.subscriptions` in `activate()`.
- **New setting:** add under `contributes.configuration.properties` (prefix `arabicRtlSupport.`) and read it in `updateDecorationType()`. Config changes auto-apply via the `onDidChangeConfiguration` watcher.
- All disposables (commands, watchers, status bar item) must be pushed to `context.subscriptions`.
