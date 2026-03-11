# Documentation Style Guide

## Two Types of Documentation

### Internal Documentation (`docs/`)

**Location**: `docs/`
**Audience**: Developers working on the codebase
**Content**: TypeDoc API reference (`docs/api/`), quality checklist (`docs/CHECKLIST.md`), this guide

### Public Documentation (`packages/site/`)

**Location**: `packages/site/src/content/docs/`
**Audience**: Users of @witqq/spreadsheet
**Content**: Guides, API reference, framework integration, migration docs
**Framework**: Astro + Starlight

### Key Differences

| Aspect        | Internal (`docs/`)       | Public (`packages/site/`)     |
| ------------- | ------------------------ | ----------------------------- |
| Scope         | System internals         | User-facing features          |
| Detail level  | Implementation-specific  | Usage-focused with demos      |
| Code examples | TypeScript internals     | React/Vue/Angular integration |
| Format        | Markdown + TypeDoc       | MDX with interactive demos    |

## Mandatory: Keep All Documentation in Sync with Code

When adding, changing, or removing **public API functions, interfaces, config options, or user-visible behavior**, update **both** the site docs and the relevant npm package README:

### Site Docs

1. Update the relevant guide in `packages/site/src/content/docs/guides/`
2. Update `packages/site/src/content/docs/api/` if types or engine API changed
3. Add or update interactive demo components in `packages/site/src/components/demos/` if the feature is visual

### npm Package READMEs

4. Update `packages/core/README.md` if core API changed — every exported class, function, interface, and type must have a README entry
5. Update the relevant wrapper README (`packages/react/README.md`, `packages/vue/README.md`, etc.) if wrapper API changed
6. Update `packages/plugins/README.md` if plugin API changed

### Code-Change-to-Documentation Mapping

| Code Change | Site Docs Update | README Update |
|---|---|---|
| New `SpreadsheetEngineConfig` option | `api/wit-engine.mdx` + relevant guide | `packages/core/README.md` Configuration section |
| New column type or `CellType` | `api/cell-types.mdx` | `packages/core/README.md` Cell Types section |
| New public interface/type | `api/types.mdx` | `packages/core/README.md` Types section |
| New editing behavior | `guides/editing.mdx` | `packages/core/README.md` if public API |
| New context menu feature | `guides/context-menu.mdx` | `packages/core/README.md` if public API |
| New plugin capability | `plugins/` section | `packages/plugins/README.md` |
| Changed keyboard shortcuts | Relevant guide | — |
| New framework wrapper API | `frameworks/` section | Wrapper package README |
| New style property or type | `api/types.mdx` + `guides/styling.mdx` (create if missing) | `packages/core/README.md` Styling section |
| New decorator API method | `api/cell-types.mdx` + `guides/decorators.mdx` (create if missing) | `packages/core/README.md` Decorators section |

### Examples Requirement

Every documented API (site docs and READMEs) must include at least one working code example demonstrating typical usage. Examples must:

- Use real API names from current source code
- Be self-contained (reader can copy-paste and run)
- Show the import path when relevant

### Sync Checklist

Before merging any PR that touches public API:

- [ ] Every new export in `packages/core/src/index.ts` has a corresponding site docs entry
- [ ] Every new export has a corresponding core README entry
- [ ] Every new export has TSDoc comments in source
- [ ] Code examples in docs match current API signatures
- [ ] Wrapper/plugin READMEs updated if their API changed
- [ ] Demo components updated if the feature is visual
- [ ] Site builds clean (`npm run build` in `packages/site/`)

### What Does NOT Require Documentation Update

- Internal refactoring with no API change
- Test additions
- Build/CI changes
- Performance optimizations (unless config options changed)

## TSDoc on Public APIs

All public interfaces, types, and functions exported from `packages/core/src/index.ts` must have TSDoc comments:

```typescript
/**
 * Configuration for automatic row height measurement.
 * When enabled, row heights adjust to fit wrapped text content.
 */
export interface AutoRowSizeConfig {
  /** Batch size for off-screen async measurement. Default: 100. */
  batchSize?: number;
  /** Minimum row height (prevents rows from collapsing). Default: the grid's default row height. */
  minRowHeight?: number;
  /** Vertical padding to add to measured height per row. Default: 8. */
  cellPadding?: number;
}
```

Complex algorithms require inline comments explaining "why", not "what":

```typescript
// Measure viewport rows synchronously for instant visual result,
// defer off-screen rows to idle callbacks to avoid blocking
```

## Content Rules

### Forbidden

- Historical information ("was changed", "replaced", "improved")
- Marketing language ("enhanced", "better", "amazing")
- Test counts ("42/42 tests pass")
- Version-specific details in guides
- Personal opinions ("we recommend")

### Required

- Technical facts only
- Code examples with real syntax from source
- Concrete commands and paths
- Interface definitions matching actual code

## File Structure

```
docs/
  api/                          # TypeDoc generated API reference
  ARCHITECTURE.md               # System architecture overview
  CHECKLIST.md                  # Quality checklist for PRs
  DOCUMENTATION-STYLE-GUIDE.md  # This file
  SCREENSHOT-VALIDATION-GUIDE.md # Visual regression testing guide
  TESTING-GUIDE.md              # Testing practices and patterns

packages/site/src/content/docs/
  api/                  # Public API reference (MDX)
  concepts/             # Core concepts
  frameworks/           # React, Vue, Angular, Widget guides
  getting-started/      # Installation, quick start
  guides/               # Feature guides with interactive demos
  plugins/              # Plugin documentation
```
