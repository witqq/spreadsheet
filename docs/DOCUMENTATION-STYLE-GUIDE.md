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

## Mandatory: Keep Site Docs in Sync with Code

When adding, changing, or removing **public API functions, interfaces, config options, or user-visible behavior**:

1. Update the relevant guide in `packages/site/src/content/docs/guides/`
2. Update `packages/site/src/content/docs/api/` if types or engine API changed
3. Add or update interactive demo components in `packages/site/src/components/demos/` if the feature is visual

### What Triggers a Site Docs Update

| Code Change | Required Site Update |
|---|---|
| New `SpreadsheetEngineConfig` option | `api/wit-engine.mdx` + relevant guide |
| New column type or `CellType` | `api/cell-types.mdx` |
| New public interface/type | `api/types.mdx` |
| New editing behavior | `guides/editing.mdx` |
| New context menu feature | `guides/context-menu.mdx` |
| New plugin capability | `plugins/` section |
| Changed keyboard shortcuts | Relevant guide |
| New framework wrapper API | `frameworks/` section |

### What Does NOT Require Site Update

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
  /** Number of rows to measure per idle callback batch. Default: 50 */
  batchSize?: number;
  /** Minimum row height in pixels. Default: 24 */
  minRowHeight?: number;
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
  api/                  # TypeDoc generated API reference
  CHECKLIST.md          # Quality checklist for PRs
  DOCUMENTATION-STYLE-GUIDE.md  # This file

packages/site/src/content/docs/
  api/                  # Public API reference (MDX)
  concepts/             # Core concepts
  frameworks/           # React, Vue, Angular, Widget guides
  getting-started/      # Installation, quick start
  guides/               # Feature guides with interactive demos
  plugins/              # Plugin documentation
```
