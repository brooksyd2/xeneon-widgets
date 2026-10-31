# Gmail (iCUE widget, XENEON EDGE extra-large slot)

A glanceable work-day view for the extra-large dashboard slot (2536 × 696, landscape, touch). Built with the Edge Ink design system: graphite panels, mint for the current or next thing, hand-lettered panel labels, 64 px minimum touch targets.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole widget: markup, CSS and JS inline. `<head>` is strict XML (uppercase DOCTYPE, every tag self-closed, no `<` or `&` in the inline CSS). |
| `manifest.json` | iCUE manifest: `dashboard_lcd`, `interactive: true`, and `url` permissions for `localhost:8817` and `127.0.0.1:8817` only (no required plugins). |
| `icon.svg` | Selector and marketplace icon. |
| `fonts/` | Inter (400/500/600), JetBrains Mono (400/500), Caveat (500/600), Latin woff2, plus their OFL licences. Nothing loads from the internet. |
| `screenshots/` | One PNG per state, rendered from demo mode. |

## Settings

One iCUE setting, in the **Companion** group:

- **Companion token** (`companionToken`, textfield): the token printed by `node companion`. Changing it triggers an immediate refresh.

## Layout

Four panels, left to right (520 / 560 / 720 / 664 px, 24 px gutters).

1. **Next meeting** (`next up`)
   - Countdown to the next timed meeting: `in 12m`, `in 1h15`, then `now` at the start time. Mint hand underline beneath the figure.
   - Urgency: 10 minutes or less turns the figure and underline amber and adds a **Soon** badge; 5 minutes or less also gives the panel an amber border and a pulsing **Starting** badge.
   - Title (two lines max), `start–end`, and `Google Meet · 30m · 6 guests`.
   - **Join** (full width, 96 px): asks the companion to open Google Meet and start a Granola note. Shows `Opening Meet…` for 2.5 s. If the companion call fails, falls back to opening the Meet link via the Link Provider plugin if it happens to be installed (it is not required).
   - No Meet link: no Join button; shows the location and "no video link" instead.
   - In progress (label `now`): time remaining (`18m left`), a progress bar with start and end times, the title, and `Then 15:30 1:1 …`. Join stays available for rejoining.
   - None left today: "No more meetings today" plus tomorrow's first meeting, if the companion supplies it.
2. **Today's meetings** (`today`)
   - All-day events as a thin strip at the top.
   - The rest of today in time order, excluding past meetings and the one in panel 1. Titles wrap to two lines.
   - Joinable rows are buttons (84 px tall) with a Meet icon; tapping joins. Non-joinable rows are not interactive.
   - Panels do not scroll here: if more than fit, the last row becomes `+N later, until 19:00`.
3. **Inbox** (`inbox`, Gmail Primary only)
   - Newest first, touch-scrolling list; `N unread` badge in the header.
   - Each row: sender and time, subject, one-line snippet. Unread rows have an ink dot and semibold ink sender and subject; read rows are muted.
   - **Mark read** (unread rows only) and **Archive**: 64 × 64 icon buttons with accessible labels. Both are optimistic.
   - Tap a row to select it (mint-soft ground). Selecting does not mark it read.
   - Empty: `inbox zero` and "Nothing in Primary. Checked at 18:19".
4. **Reading view** (`reading`)
   - Selected email's subject, sender name and address, date and time, and plain-text body, scrolling independently.
   - URLs are shown as underlined text, never as buttons. No HTML, images or attachments.

## States

| State | What you see |
| --- | --- |
| Normal | Live data; actions enabled. |
| Meeting in progress | Panel 1 switches to time remaining and progress. |
| Quiet | Calm empty states in all four panels. |
| Companion not running | Last known data dimmed to 42%, all action buttons disabled (rows can still be selected to read cached mail), amber `Companion not running · from 14:05` badge in the inbox header. Polling continues and the widget recovers on its own. If it has never connected, panel 1 says how to start it. |
| Set-up needed | No token set: panel 1 explains the three steps; other panels show quiet placeholders. If the companion rejects the token (401) the heading becomes "That token was not accepted". |
| Signed out | Companion reachable but not signed in to Google: panel 1 shows `node companion signin`. |
| Archive failed | The row is put back in its original position with a red outline, and a toast reads "Couldn't archive "…". It's back in your inbox." Both clear after 6 s. Mark read failures revert the same way. |

## Demo mode

Open `index.html?demo=<state>` in any browser (or in iCUE). Demo mode uses fixed sample data (Tue 3 Nov), makes no network calls, and actions behave as if the companion succeeded.

| `demo=` | Shows |
| --- | --- |
| `normal` | Next meeting in 12 min, 4 more today, 20 emails with 5 unread, one selected |
| `soon` | Next meeting in 3 min (urgent styling) |
| `meeting` | Meeting in progress, 18 min left |
| `quiet` | No meetings left, inbox empty |
| `offline` | Companion not running |
| `setup` | Token needed |
| `signedout` | Sign in from the companion |
| `archivefail` | Archives a row on load, which fails and is restored; every archive fails in this mode |

For live testing in a browser, `?token=<token>` stands in for the iCUE setting.

## Companion contract

The widget only talks to `http://localhost:8817/v1` (`localhost` and `127.0.0.1` on port 8817 are the only hosts allowed in the manifest). Every request sends `Authorization: Bearer <token>`. The companion must send CORS headers allowing that header from any origin.

| Method and path | Purpose |
| --- | --- |
| `GET /state` | `{ events: [...], tomorrowFirst?, messages: [...] }`. Events: `id, title, start, end` (ISO 8601), `allDay`, `meetUrl?`, `location?`, `guests?`; today's only. Messages: Gmail Primary inbox, `id, from: {name, email}, subject, snippet, date, unread`. |
| `GET /messages/:id` | `{ body }` as plain text, fetched when a row is selected and cached. |
| `POST /messages/:id/archive` | Remove the INBOX label. |
| `POST /messages/:id/read` | Remove the UNREAD label. |
| `POST /events/:id/join` | Open the Meet link in the browser and start a Granola note. |

Errors: unreachable or timeout (6 s) means **Companion not running**; `401` means **bad token**; any status with `{ "error": "signed_out" }` means **Signed out**.

Timing: data refreshes every 30 s; countdowns re-render every 5 s; minutes round up, so 11:59 to go reads `in 12m`.

## Install

Copy this folder into iCUE's widget import (or package it per Corsair's widget tooling), add the widget to the extra-large slot, then paste the companion token into its settings. Companion set-up (Google sign-in, running it at login) is in `companion/README.md` at the repo root; the token is printed by `node companion`. Requires iCUE 5.52 or later (Widget API 1.9.0).
