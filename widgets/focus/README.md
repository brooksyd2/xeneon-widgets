# Focus: Obsidian tasks widget for the Xeneon Edge

An iCUE HTML widget that shows high-priority and overdue Obsidian tasks, with tap to complete and tap to open. Styled with the Edge Ink design system.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole widget: markup, CSS and JS inline. No external requests except the local Obsidian API. |
| `manifest.json` | iCUE widget manifest. Check `min_framework_version`, `min_app_version` and `supported_devices` against the current iCUE spec before packaging. |
| `icon.svg` | Widget icon. |
| `fonts/` | Inter, JetBrains Mono and Caveat (latin subsets, woff2, SIL OFL; licences in `fonts/licences/`). Loaded by relative path. |

## Prerequisites

1. Obsidian with the **Local REST API** plugin (coddingtonbear/obsidian-local-rest-api).
2. In its settings, turn on **Enable non-encrypted (HTTP) server** (port 27123). The HTTPS endpoint (27124) uses a self-signed certificate that the embedded Chromium is likely to reject.
3. Paste the plugin's API key into the widget's **Obsidian API key** setting in iCUE.
4. Optional: a `People` folder whose note names are people (`People/Tom Mussett.md`). Links to those notes are shown as short names (`Tom M`). Change the folder in the **People folder** setting.

## iCUE settings (meta controls)

| Property | Type | Default | Notes |
| --- | --- | --- | --- |
| `apiKey` | textfield | empty | Empty shows the set-up state. |
| `apiUrl` | textfield | `http://127.0.0.1:27123` | Local REST API base URL. |
| `peopleFolder` | textfield | `People` | Folder of person notes. |

iCUE parses `<head>` as strict XML, so every tag there is self-closed and the doctype is uppercase. Keep it that way. Check the iCUE **Permissions** reference in case local network access needs declaring in `manifest.json`.

## Layout

The layout is chosen by viewport width: 1600px or wider uses the extra-large layout.

| Tile | Size | Next up | List |
| --- | --- | --- | --- |
| Small | 840 × 344 | Up to 3 lines at 32px, priority, due, people, note | 3 visible rows, single line, swipe to scroll |
| Extra-large | 2536 × 696 | Full text (up to 4 lines at 52px), priority, due with hand circle when overdue, scheduled, people chips, tappable note link | 2 columns, 2-line text with full meta, about 8 visible, swipe to scroll |

All tap targets are 64px or more. There are no hover states.

## Data

**Which tasks.** Open tasks (`- [ ]`) using Obsidian Tasks emoji syntax, where:

- priority is ⏫ or 🔺 (high) or 🔼 (medium), **or**
- 📅 due date is before today (any priority).

**Sort.** Overdue first, then due date ascending (undated last), then high before medium, then path and line. The first task is Next up.

**Parsed fields.** 📅 due, ⏳ scheduled, priority, people (wikilinks to notes in the people folder, or `@Name`) and the note label (`Folder · 7 Oct` for daily notes named `YYYY-MM-DD`, otherwise the note name). Tags, block IDs, recurrence and other date fields are removed from the display text.

**Fetching** (every 60 seconds and after each completion):

1. `GET /vault/{peopleFolder}/` lists the person notes.
2. `POST /search/simple/?query=…` for ⏫, 🔺, 🔼 and 📅 finds candidate files (capped at 150).
3. `GET /vault/{file}` (Accept `text/markdown`), 4 at a time, and each line is parsed.

The last good result is cached in `localStorage` and shown immediately on start.

**Complete.** The widget re-reads the note, finds the exact line (at its recorded index, else by matching the raw text), changes `[ ]` to `[x]`, appends `✅ YYYY-MM-DD` and `PUT`s the note back. The UI is optimistic: the tick and strike-through show at once, the item leaves after 1 second once the write has succeeded, and the next task slides into Next up. On failure the item is restored and a footer notice explains. Recurring tasks (🔁) are ticked without creating the next occurrence; the Tasks plugin only does that through its own UI.

**Open.** `POST /open/{file}` opens the note in Obsidian.

## States

| State | Trigger | Behaviour |
| --- | --- | --- |
| Normal | Tasks loaded | Next up and list. Overdue tasks use a danger checkbox, red due date and an overdue badge on Next up. |
| Completing | Checkbox tapped | Tick draws, text struck and faded, label reads "done", next row highlighted in mint, then the list re-flows. |
| All clear | No matching tasks | Hand tick and "all clear" message. |
| Obsidian not running | Network error | Last tasks stay visible. Checkboxes are dashed and disabled, taps do nothing, and the footer shows "last updated HH:MM" plus a warning badge. With no cache, a waiting message shows instead. |
| Set up | No API key, or 401/403 | Set-up steps. A rejected key shows "Obsidian didn't accept the API key". |

## Previewing without iCUE

Open `index.html?demo=normal|completing|clear|offline|setup&size=s|xl` in Chromium. Demo mode uses sample data dated 31 Oct 2026, makes no network calls and lets you tap to complete.

## Tuning

`CONFIG` at the top of the script sets the refresh interval, completion hold, breakpoint, file cap and request timeout. Colour and type tokens are CSS custom properties at the top of the stylesheet, copied from Edge Ink v1.
