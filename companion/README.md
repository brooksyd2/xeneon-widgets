# Xeneon companion

A small local service that the Xeneon widgets talk to for Google data (Gmail and Calendar). It uses Node only, with no npm dependencies.

## Running

- `node companion` starts the service and prints the bearer token and the listening URL.
- `node companion signin` signs in to Google (see Google set-up). The refresh token is stored in `accounts.json`, encrypted with Windows DPAPI for your user.

## Google set-up

1. In the Google Cloud console, create a project in the Arbor organisation.
2. Enable the Gmail API and the Google Calendar API.
3. Configure the OAuth consent screen with user type **Internal**.
4. Create an OAuth client of type **Desktop app**.
5. Put its `clientId` and `clientSecret` into `config.json`.
6. Run `node companion signin`, approve in the browser, and the signed-in email is printed.

If Internal is not available, use user type External and set the publishing status to **In production**. Google then shows a one-off "unverified app" warning at sign-in, which you can click through.

## Install and auto-start

1. Copy `companion/` to `C:\Users\brook\Documents\xeneon-build\companion\`.
2. From `xeneon-build`, run `node companion` once. It creates `config.json` with the token and prints it; stop it with Ctrl+C.
3. Put the Google client id and secret into `config.json` (see Google set-up), then run `node companion signin`.
4. To start it at login, place a shortcut to `companion\start-hidden.vbs` in `shell:startup` (press Win+R, type `shell:startup`). The script runs `node` with no window; if wscript cannot find `node`, edit the script to use the full path to `node.exe`. Stop it from Task Manager (end the `node.exe` process).
5. Package the widget as for Obsidian: copy `dist/gmail` to `xeneon-build\gmail`, then in `xeneon-build` run `icuewidget validate gmail` and `icuewidget package gmail`. The "translation.json is missing" warning is harmless.

## Device checklist

- [ ] Create the OAuth client (Internal), add it to `config.json`, and run `node companion signin` with the Arbor account.
- [ ] Install `gmail.icuewidget`, approve permissions, and paste the token.
- [ ] Meetings and the Primary inbox match Gmail and Calendar.
- [ ] Archive and mark read appear in Gmail within a refresh.
- [ ] The reading view shows a plain-text body.
- [ ] Join opens Meet and a Granola note for that meeting (note whether Granola starts transcribing by itself).
- [ ] Stopping the companion shows "Companion not running" with dimmed data, and it recovers when restarted.

## Where data lives

`%APPDATA%\xeneon-companion\` on Windows, or the folder in `XENEON_COMPANION_DIR`. It holds `config.json` (token, client id and secret) and `accounts.json`. Never commit either file.

## Security

- Listens on `127.0.0.1:8817` only.
- Every request except a CORS preflight needs `Authorization: Bearer <token>`.
- Nothing leaves the PC except requests to Google.
