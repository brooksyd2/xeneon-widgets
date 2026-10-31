# Xeneon widgets

Corsair iCUE widgets for the Xeneon Edge touchscreen. Each widget is a plain HTML/CSS/JS folder rendered by iCUE's Chromium.

## Widgets

- `widgets/obsidian/`: Obsidian high-priority and overdue tasks, with tap to complete and tap to open.
- `widgets/gmail/`: next meeting with one-tap Join, today's meetings and the Gmail Primary inbox; needs the companion.
- `companion/`: local Node service (127.0.0.1:8817) that gives widgets access to Google data; see `companion/README.md`.

## Layout

- `widgets/<name>/`: one folder per widget (`manifest.json`, `index.html`, `designs/` reference PNGs).
- `shared/`: code reused by widgets (`edge-ink.css`, `fonts/`, `dates.js`, `icue.js`, `mcp.js` for the Obsidian MCP server; `obsidian-mcp.md` records the plugin behaviour it relies on).
- `scripts/build.mjs`: builds a widget into `dist/<name>/`.
- `tests/`: `node --test` suites (`tests/shared/`, `tests/<name>/`).

## Adding a widget

Create `widgets/<name>/` with `manifest.json`, `index.html` and `designs/`. Include shared files as `shared/<file>` (never `../`); the build copies `shared/` into each widget's output.

## Commands

- `npm test` runs the tests (Node, no dependencies).
- `npm run build` builds every widget into `dist/` (`node scripts/build.mjs <name>` for one). `dist/` is git-ignored.

## Packaging

On Windows, run `icuewidget package dist/<name>`.
