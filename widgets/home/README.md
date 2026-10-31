# Home (iCUE widget, XENEON EDGE extra-large slot)

Cameras, air con, heating and the coffee machine from Home Assistant, on the extra-large dashboard slot (2536 × 696, landscape, touch). A fixed panel for one house, not a general Home Assistant client. Built from the Claude Design export (Edge Ink design system); `designs/` holds the export's PNG for each state.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole widget: markup, CSS and JS inline. `<head>` is strict XML (uppercase DOCTYPE, every tag self-closed, no `<` or `&` in it); the main `<style>` is in `<body>`. |
| `lib.js` | Pure helpers (`HomeLib`): age text, heating step snapping and status, pending/failed resolution, connection state, coffee minutes. Tested in `tests/home/lib.test.js`. |
| `manifest.json` | iCUE manifest: `dashboard_lcd`, `interactive: true`, and `url` permissions for `localhost:8817` and `127.0.0.1:8817` only (no required plugins). |
| `icon.svg` | Selector and marketplace icon. |
| `designs/` | The export's PNG per state (reference only; not packaged). |

Fonts (Inter, JetBrains Mono, Caveat) and `icue.js` come from `shared/`, copied in by the build. Nothing loads from the internet.

## Settings

One iCUE setting, in the **Companion** group:

- **Companion token** (`companionToken`, textfield): the token printed by `node companion`. Empty means the set-up state. Changing it triggers an immediate refresh.

## Layout

Four panels, left to right (734 / 960 / 440 / 330 px, 24 px gutters).

1. **Cameras**: Back Garden (wide), Front and Doorbell stills, each captioned `updated Ns ago` (amber from 1 minute). Tap a still for the live view. An offline camera shows a dashed tile with `Offline` and the time of its last image.
2. **Air con**: eight tiles; Damian's Office and Damian's Bedroom are the large ones in column 1. Tile shows room temperature and Off, or mode and target when on. Tap toggles; header shows `N on` or `All off`.
3. **Heating**: room temperature, target with − / + (0.5° steps, within the thermostat's min/max; an off-step target snaps to the nearest 0.5 first), badge and status line from `hvac_action` (Heating / Idle / Off). Target shows `—` when the thermostat has none.
4. **Coffee**: one button. Off: "Tap to turn on". On: `On`, `for Nm`. Tapping when on does nothing; the widget cannot turn it off.

Live view: camera name and `Live` on the left, the MJPEG stream in the middle with the current time, a large Close on the right.

## States

| State | What you see |
| --- | --- |
| Normal | Live data; controls enabled. |
| AC pending | Dashed tile, spinner, `Turning on` / `Turning off`, until a state poll confirms it. |
| AC failed | No confirmation within 10 s, or the request failed: red outline, `Failed`, "No response. Tap to retry". |
| Coffee pending / failed | Spinner and `Turning on`, then "No response. Tap to retry" on the same rule. |
| Camera offline | Dashed tile, `Offline`, `<name> · last image HH:MM`. |
| Companion not running | Data dimmed, controls disabled, amber `Companion not running · from HH:MM` in the air con header. Recovers on its own. If it has never connected, only that badge shows. |
| Home Assistant not responding | Same, with `Home Assistant not responding · from HH:MM` (companion errors `home_assistant`, `ha_unauthorised`, `ha_not_configured`). |
| Set-up needed | No token, or the companion rejects it (401): the three set-up steps and quiet placeholders. |

## Polling

- `GET /home/state` every 5 s (6 s timeout). "from HH:MM" is the first failed poll.
- Each online camera's still every 5 s with a cache-busting query; a new image replaces the old one only once it has loaded, and the age counts from that load. Stills pause while the live view is open.
- Live view uses `GET /home/cameras/:id/live` in an `<img>`; Close removes it, which closes the stream. If the stream fails to load, the live view refreshes the still once a second instead.
- Heating − / + sends one `POST /home/heating/target` 1 s after the last tap; polls do not overwrite the shown target meanwhile, and a failure reverts to the last polled target.

## Demo mode

Open `index.html?demo=<state>` in any browser (or in iCUE). Demo mode uses the export's sample data and SVG scenes, makes no network calls, and taps behave as in the export's prototype.

`demo=` one of `normal`, `busy`, `pending`, `failed`, `camoffline`, `live`, `offline`, `haunreachable`, `setup`.

For live testing in a browser, `?token=<token>` stands in for the iCUE setting.

## Companion contract

Base `http://localhost:8817/v1`, `Authorization: Bearer <token>` (camera images use `?token=`, since an `<img>` cannot send a header).

| Method and path | Purpose |
| --- | --- |
| `GET /home/state` | `{ cameras, ac, heat, coffee }` |
| `POST /home/ac/:id/toggle` | `{ on }`: the desired state, so a double tap cannot invert it |
| `POST /home/heating/target` | `{ target }` |
| `POST /home/coffee/on` | Turn the plug on |
| `GET /home/cameras/:id/still` | JPEG |
| `GET /home/cameras/:id/live` | MJPEG stream |

## Install

Run `npm run build`, then package or import `dist/home` as for the other widgets, add it to the extra-large slot and paste the companion token into its settings. Companion set-up, including `haUrl` and `haToken`, is in `companion/README.md`.
