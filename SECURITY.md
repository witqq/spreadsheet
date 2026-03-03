# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email belyiwork@mail.ru with details
3. Include steps to reproduce if possible

We will acknowledge receipt within 48 hours and provide a timeline for a fix.

## Scope

Security issues in the following areas are in scope:

- `@witqq/spreadsheet` — Canvas rendering engine
- `@witqq/spreadsheet-plugins` — Official plugins (formula evaluation, collaboration OT)
- `packages/server` — WebSocket collaboration server

Client-side XSS via cell content, formula injection, and OT operation validation are examples of relevant concerns.
