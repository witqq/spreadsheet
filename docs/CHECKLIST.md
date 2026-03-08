# Quality Checklist

Pre-merge quality gates for @witqq/spreadsheet.

## Code Quality

- [ ] `npm run typecheck` passes (zero errors)
- [ ] `npm run lint` passes (zero warnings)
- [ ] `npm run format` applied (no diff)
- [ ] No `any` types without justification comment
- [ ] No `// @ts-ignore` without issue reference

## Testing

- [ ] `npm run test` — all unit tests pass
- [ ] `npm run test:e2e` — all E2E tests pass
- [ ] New code has unit tests (target: >80% branch coverage for changed files)
- [ ] Performance-sensitive code has benchmark test
- [ ] Edge cases covered: empty data, single row/col, large datasets (10K+ rows)

## Performance

- [ ] No regressions in render benchmarks (>10% degradation = block)
- [ ] Canvas operations batched (no unnecessary `beginPath`/`stroke` in loops)
- [ ] Large allocations avoided in hot paths (render, scroll, measure)
- [ ] Caches used for repeated computations (TextMeasureCache, LayoutEngine)

## API & Compatibility

- [ ] Public API changes documented in CHANGELOG
- [ ] No breaking changes to existing `SpreadsheetEngine` config
- [ ] New interfaces exported from `packages/core/src/index.ts`
- [ ] React/Vue/Angular wrappers updated if core API changed

## Documentation

- [ ] New public APIs have TSDoc comments
- [ ] Complex algorithms have inline comments explaining "why"
- [ ] Demo page updated if feature is user-visible

## Review Criteria

- [ ] PR description explains what and why
- [ ] Changes are minimal and focused (one feature per PR)
- [ ] No unrelated formatting changes
