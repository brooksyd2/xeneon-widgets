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

## Where data lives

`%APPDATA%\xeneon-companion\` on Windows, or the folder in `XENEON_COMPANION_DIR`. It holds `config.json` (token, client id and secret) and `accounts.json`. Never commit either file.

## Security

- Listens on `127.0.0.1:8817` only.
- Every request except a CORS preflight needs `Authorization: Bearer <token>`.
- Nothing leaves the PC except requests to Google.
