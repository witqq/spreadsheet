# Contributing to witqq spreadsheet

Thank you for your interest in contributing! For full documentation, interactive demos, and API reference, visit the [project website](https://witqq.dev).

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/wit-table.git`
3. Install dependencies: `npm install`
4. Start the development server: `npm run dev`

## Development

```bash
npm run dev          # Docker build + run (port 3150)
npm run build        # Build all packages
npm run typecheck    # TypeScript check
npm run lint         # ESLint
npm run test         # Unit tests (vitest)
npm run test:e2e     # E2E tests (playwright)
npm run benchmark    # Performance benchmarks (6 metrics × 3 datasets)
npm run docs:npm     # Generate npm package docs from site MDX
```

## Project Structure

- `packages/core/` — Canvas engine (pure TypeScript, zero dependencies)
- `packages/react/` — React wrapper
- `packages/vue/` — Vue 3 wrapper
- `packages/angular/` — Angular wrapper
- `packages/widget/` — Embeddable IIFE/UMD bundle
- `packages/plugins/` — Official plugins (formula, collaboration, conditional-format, excel, context-menu, progressive-loader)
- `packages/demo/` — Demo application
- `packages/site/` — Public website (Astro + Starlight)

## Making Changes

1. Create a feature branch from `master`
2. Make your changes with tests
3. Run `npm run build && npm run test` to verify
4. Submit a pull request

## Code Style

- TypeScript strict mode
- ESLint flat config (run `npm run lint`)
- Prettier (single quotes, trailing commas; run `npm run format`)

## Plugin Development

witqq spreadsheet has a plugin system. See `packages/core/src/plugins/` for the interface definition and `packages/plugins/` for official plugin examples.

## Commit Messages

Follow conventional commits: `type(scope): description`

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `perf`, `chore`

## Reporting Issues

Use GitHub Issues with the provided templates. Include:
- witqq spreadsheet version
- Browser and OS
- Steps to reproduce
- Expected vs actual behavior

## License

By contributing, you agree that your contributions will be licensed under the BSL 1.1 license (see LICENSE file). Contributions will transition to Apache 2.0 on the Change Date (2030-03-01).
