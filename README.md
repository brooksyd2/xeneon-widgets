# Xeneon widgets

Corsair iCUE widgets for the Xeneon Edge touchscreen. Each widget is a plain HTML/CSS/JS folder rendered by iCUE's Chromium.

## Layout

- `widgets/<name>/`: one folder per widget (`manifest.json`, `index.html`, `designs/` reference PNGs).
- `shared/`: code reused by widgets (`edge-ink.css`, `fonts/`, `dates.js`, `icue.js`).
- `scripts/build.mjs`: builds a widget into `dist/<name>/`.
- `tests/`: `node --test` suites (`tests/shared/`, `tests/<name>/`).

## Adding a widget

Create `widgets/<name>/` with `manifest.json`, `index.html` and `designs/`. Include shared files as `shared/<file>` (never `../`); the build copies `shared/` into each widget's output.

## Commands

- `npm test` runs the tests (Node, no dependencies).
- `npm run build` builds every widget into `dist/` (`node scripts/build.mjs <name>` for one). `dist/` is git-ignored.

## Packaging

On Windows, run `icuewidget package dist/<name>`.
