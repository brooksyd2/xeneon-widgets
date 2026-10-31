# Xeneon companion

A small local service that the Xeneon widgets talk to for Google data (Gmail and Calendar). It uses Node only, with no npm dependencies.

## Running

- `node companion` starts the service and prints the bearer token and the listening URL.
- `node companion signin` signs in to Google (added in a later task).

## Where data lives

`%APPDATA%\xeneon-companion\` on Windows, or the folder in `XENEON_COMPANION_DIR`. It holds `config.json` (token, client id and secret) and `accounts.json`. Never commit either file.

## Security

- Listens on `127.0.0.1:8817` only.
- Every request except a CORS preflight needs `Authorization: Bearer <token>`.
- Nothing leaves the PC except requests to Google.
