import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {
  extractFrontmatter,
  parseImports,
  convertDemoComponent,
  convertCodeComponent,
  stripRemainingJsx,
  cleanupEmptyLines,
  computeSlug,
  computeOutputPath,
  convertMdxToMd,
  generateDocs,
  matchesFilter,
  generateNavigatorReadme,
  generateForPackage,
} from './generate-npm-docs';

const SITE_DOCS_DIR = path.resolve(
  __dirname,
  '../packages/site/src/content/docs',
);

describe('generate-npm-docs', () => {
  describe('extractFrontmatter', () => {
    it('extracts title and description', () => {
      const content = `---
title: Sorting
description: Sort your data
---

Some content here.`;
      const result = extractFrontmatter(content);
      expect(result.title).toBe('Sorting');
      expect(result.description).toBe('Sort your data');
      expect(result.rest.trim()).toBe('Some content here.');
      expect(result.isSplash).toBe(false);
    });

    it('handles quoted title', () => {
      const content = `---
title: "@witqq/spreadsheet Documentation"
description: Canvas spreadsheet engine
---

Body`;
      const result = extractFrontmatter(content);
      expect(result.title).toBe('@witqq/spreadsheet Documentation');
    });

    it('detects splash template', () => {
      const content = `---
title: Docs
template: splash
hero:
  title: My Title
---

Welcome`;
      const result = extractFrontmatter(content);
      expect(result.isSplash).toBe(true);
    });

    it('returns empty fields for no frontmatter', () => {
      const result = extractFrontmatter('Just plain content');
      expect(result.title).toBe('');
      expect(result.rest).toBe('Just plain content');
    });
  });

  describe('parseImports', () => {
    it('strips all imports and collects raw imports', () => {
      const content = `import { SortingDemo } from '../../../components/demos/SortingDemo';
import sortingSource from '../../../components/demos/SortingDemo.tsx?raw';
import { Code } from '@astrojs/starlight/components';

Some content after imports.`;

      const result = parseImports(content);
      expect(result.rawImports).toHaveLength(1);
      expect(result.rawImports[0].variableName).toBe('sortingSource');
      expect(result.rawImports[0].filePath).toBe(
        '../../../components/demos/SortingDemo.tsx',
      );
      expect(result.cleaned.trim()).toBe('Some content after imports.');
    });

    it('handles content with no imports', () => {
      const content = 'No imports here.\n\nJust markdown.';
      const result = parseImports(content);
      expect(result.rawImports).toHaveLength(0);
      expect(result.cleaned).toBe(content);
    });

    it('preserves imports inside fenced code blocks', () => {
      const content = `import { SortingDemo } from '../demos/SortingDemo';

Some text.

\`\`\`tsx
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';

const columns: ColumnDef[] = [];
\`\`\`

More text.`;

      const result = parseImports(content);
      expect(result.rawImports).toHaveLength(0);
      // Top-level import stripped
      expect(result.cleaned).not.toMatch(/^import \{ SortingDemo \}/m);
      // Imports inside code block preserved
      expect(result.cleaned).toContain(
        "import { Spreadsheet } from '@witqq/spreadsheet-react';",
      );
      expect(result.cleaned).toContain(
        "import type { ColumnDef } from '@witqq/spreadsheet';",
      );
    });
  });

  describe('convertDemoComponent', () => {
    it('replaces demo component with live demo link', () => {
      const content = '<SortingDemo client:visible />';
      const result = convertDemoComponent(content, 'guides/sorting');
      expect(result).toContain('**Live Demo**');
      expect(result).toContain(
        'https://spreadsheet.witqq.dev/guides/sorting/',
      );
    });

    it('handles components with props', () => {
      const content = '<MillionRowsDemo height={500} client:visible />';
      const result = convertDemoComponent(content, 'getting-started/performance');
      expect(result).toContain('**Live Demo**');
      expect(result).toContain('https://spreadsheet.witqq.dev/getting-started/performance/');
    });

    it('does not touch non-demo JSX', () => {
      const content = '<div>Some HTML</div>';
      const result = convertDemoComponent(content, 'test');
      expect(result).toBe(content);
    });

    it('emits only one live demo link for multiple demo components', () => {
      const content = `<MillionRowsDemo height={500} client:visible />

Some text.

<MillionRowsExplanation client:visible />`;
      const result = convertDemoComponent(
        content,
        'getting-started/performance',
      );
      const linkCount = (result.match(/\*\*Live Demo\*\*/g) || []).length;
      expect(linkCount).toBe(1);
    });
  });

  describe('convertCodeComponent', () => {
    it('replaces Code component with fenced code block', () => {
      const mdxFile = path.join(SITE_DOCS_DIR, 'guides/sorting.mdx');
      const rawImports = [
        {
          variableName: 'sortingSource',
          filePath: '../../../components/demos/SortingDemo.tsx',
        },
      ];
      const content =
        '<Code code={sortingSource} lang="tsx" title="SortingDemo.tsx" />';

      const result = convertCodeComponent(content, rawImports, mdxFile);
      expect(result).toContain('```tsx title="SortingDemo.tsx"');
      expect(result).toContain('export function SortingDemo');
      expect(result).toContain('```');
    });

    it('handles missing raw import gracefully', () => {
      const content = '<Code code={unknownVar} lang="tsx" />';
      const result = convertCodeComponent(content, [], '/fake/path.mdx');
      expect(result).toBe(content);
    });
  });

  describe('stripRemainingJsx', () => {
    it('removes self-closing JSX tags', () => {
      const content = 'Before\n<CustomComponent prop="value" />\nAfter';
      const result = stripRemainingJsx(content);
      expect(result).toContain('Before');
      expect(result).toContain('After');
      expect(result).not.toContain('CustomComponent');
    });

    it('preserves HTML details/summary', () => {
      const content =
        '<details>\n<summary>View source</summary>\nContent\n</details>';
      const result = stripRemainingJsx(content);
      expect(result).toContain('<details>');
      expect(result).toContain('<summary>View source</summary>');
      expect(result).toContain('</details>');
    });
  });

  describe('cleanupEmptyLines', () => {
    it('collapses multiple empty lines', () => {
      const content = 'A\n\n\n\n\nB\n\n\nC';
      const result = cleanupEmptyLines(content);
      expect(result).toBe('A\n\nB\n\nC\n');
    });
  });

  describe('computeSlug', () => {
    it('computes slug for regular file', () => {
      const slug = computeSlug(
        path.join(SITE_DOCS_DIR, 'guides/sorting.mdx'),
      );
      expect(slug).toBe('guides/sorting');
    });

    it('computes slug for index file', () => {
      const slug = computeSlug(
        path.join(SITE_DOCS_DIR, 'getting-started/index.mdx'),
      );
      expect(slug).toBe('getting-started');
    });

    it('computes slug for root index', () => {
      const slug = computeSlug(path.join(SITE_DOCS_DIR, 'index.mdx'));
      expect(slug).toBe('');
    });
  });

  describe('computeOutputPath', () => {
    it('converts .mdx to .md path', () => {
      const result = computeOutputPath(
        path.join(SITE_DOCS_DIR, 'guides/sorting.mdx'),
        '/output',
      );
      expect(result).toBe('/output/guides/sorting.md');
    });
  });

  describe('convertMdxToMd', () => {
    it('converts a full demo page', () => {
      const mdxContent = `---
title: Sorting
description: Sort columns
---

import { SortingDemo } from '../../../components/demos/SortingDemo';
import sortingSource from '../../../components/demos/SortingDemo.tsx?raw';
import { Code } from '@astrojs/starlight/components';

Click headers to sort.

<SortingDemo client:visible />

<details>
<summary>View source code</summary>
<Code code={sortingSource} lang="tsx" title="SortingDemo.tsx" />
</details>

## API Reference

Some content.`;

      const mdxPath = path.join(SITE_DOCS_DIR, 'guides/sorting.mdx');
      const result = convertMdxToMd(mdxContent, mdxPath);

      expect(result).toContain('# Sorting');
      expect(result).toContain('**Live Demo**');
      expect(result).toContain('export function SortingDemo');
      expect(result).toContain('## API Reference');
      // Check no imports outside code blocks
      const withoutCode = result.replace(/```[\s\S]*?```/g, '');
      expect(withoutCode).not.toMatch(/^import\s+/m);
      expect(withoutCode).not.toContain('client:visible');
    });

    it('converts a pure markdown page', () => {
      const mdxContent = `---
title: React
description: React wrapper
---

## Installation

\`\`\`bash
npm install @witqq/spreadsheet-react
\`\`\`

Some guide content.`;

      const result = convertMdxToMd(mdxContent, '/fake/react.mdx');
      expect(result).toContain('# React');
      expect(result).toContain('## Installation');
      expect(result).toContain('npm install');
    });

    it('converts a splash page', () => {
      const mdxContent = `---
title: "@witqq/spreadsheet Documentation"
description: Canvas spreadsheet engine
template: splash
hero:
  title: Title
---

Welcome to docs.`;

      const result = convertMdxToMd(mdxContent, '/fake/index.mdx');
      expect(result).toContain('# @witqq/spreadsheet Documentation');
      expect(result).toContain('Canvas spreadsheet engine');
      expect(result).toContain('Welcome to docs.');
    });

    it('deduplicates title heading', () => {
      const mdxContent = `---
title: Installation
description: How to install
---

# Installation

## First step`;

      const result = convertMdxToMd(mdxContent, '/fake/install.mdx');
      const h1Count = (result.match(/^# Installation$/gm) || []).length;
      expect(h1Count).toBe(1);
    });

    it('skips frontmatter title when body has a different H1', () => {
      const mdxContent = `---
title: Performance — 1M Rows
description: Perf test
---

# 1,000,000 Rows at 60 FPS

Content here.`;

      const result = convertMdxToMd(mdxContent, '/fake/performance.mdx');
      const h1matches = result.match(/^# .+$/gm) || [];
      expect(h1matches).toHaveLength(1);
      expect(h1matches[0]).toBe('# 1,000,000 Rows at 60 FPS');
    });
  });

  describe('generateDocs (integration)', () => {
    it('converts all site docs to clean markdown', () => {
      const outputDir = path.join(__dirname, '../tmp/test-npm-docs');

      const { converted, errors } = generateDocs(outputDir);

      expect(errors).toEqual([]);
      expect(converted).toBeGreaterThanOrEqual(50);

      // Verify structure
      expect(fs.existsSync(path.join(outputDir, 'index.md'))).toBe(true);
      expect(
        fs.existsSync(path.join(outputDir, 'guides/sorting.md')),
      ).toBe(true);
      expect(
        fs.existsSync(path.join(outputDir, 'frameworks/react.md')),
      ).toBe(true);

      // Verify content quality - no JSX remnants outside code blocks
      const sortingMd = fs.readFileSync(
        path.join(outputDir, 'guides/sorting.md'),
        'utf-8',
      );
      // Remove code blocks before checking for JSX
      const withoutCodeBlocks = sortingMd.replace(/```[\s\S]*?```/g, '');
      expect(withoutCodeBlocks).not.toMatch(/^import\s+/m);
      expect(withoutCodeBlocks).not.toContain('client:visible');
      expect(withoutCodeBlocks).not.toMatch(/^<[A-Z]/m);

      // Verify demo source is inlined
      expect(sortingMd).toContain('export function SortingDemo');

      // Verify live demo link
      expect(sortingMd).toContain('Live Demo');
      expect(sortingMd).toContain('spreadsheet.witqq.dev');

      // Cleanup
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it('respects doc filter to include only matching paths', () => {
      const outputDir = path.join(__dirname, '../tmp/test-npm-docs-filter');
      const filter = ['getting-started/', 'frameworks/react.mdx'];

      const { converted, skipped, errors } = generateDocs(outputDir, filter);

      expect(errors).toEqual([]);
      expect(converted).toBeGreaterThanOrEqual(6);
      expect(skipped).toBeGreaterThan(0);

      // Should have getting-started and frameworks/react
      expect(fs.existsSync(path.join(outputDir, 'getting-started/installation.md'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'frameworks/react.md'))).toBe(true);

      // Should NOT have guides or other frameworks
      expect(fs.existsSync(path.join(outputDir, 'guides/sorting.md'))).toBe(false);
      expect(fs.existsSync(path.join(outputDir, 'frameworks/vue.md'))).toBe(false);

      fs.rmSync(outputDir, { recursive: true, force: true });
    });
  });

  describe('matchesFilter', () => {
    it('returns true for null filter (no filtering)', () => {
      expect(matchesFilter('guides/sorting.mdx', null)).toBe(true);
      expect(matchesFilter('anything/here.mdx', null)).toBe(true);
    });

    it('matches directory prefixes (trailing slash)', () => {
      expect(matchesFilter('getting-started/install.mdx', ['getting-started/'])).toBe(true);
      expect(matchesFilter('guides/sorting.mdx', ['getting-started/'])).toBe(false);
    });

    it('matches exact file paths', () => {
      expect(matchesFilter('frameworks/react.mdx', ['frameworks/react.mdx'])).toBe(true);
      expect(matchesFilter('frameworks/vue.mdx', ['frameworks/react.mdx'])).toBe(false);
    });

    it('matches multiple filter rules (OR logic)', () => {
      const filters = ['getting-started/', 'frameworks/react.mdx'];
      expect(matchesFilter('getting-started/install.mdx', filters)).toBe(true);
      expect(matchesFilter('frameworks/react.mdx', filters)).toBe(true);
      expect(matchesFilter('guides/sorting.mdx', filters)).toBe(false);
    });
  });

  describe('generateNavigatorReadme', () => {
    it('generates README with TOC from docs directory', () => {
      const tmpDir = path.join(__dirname, '../tmp/test-readme-pkg');
      const docsDir = path.join(tmpDir, 'docs');
      const gsDir = path.join(docsDir, 'getting-started');
      fs.mkdirSync(gsDir, { recursive: true });
      fs.writeFileSync(path.join(gsDir, 'install.md'), '# Installation\n\nContent.\n');
      fs.writeFileSync(path.join(gsDir, 'quick-start.md'), '# Quick Start\n\nContent.\n');
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ name: '@test/pkg', description: 'Test package' }),
      );

      const readme = generateNavigatorReadme(tmpDir, 'core', '@test/pkg', 'Test package');

      expect(readme).toContain('# @test/pkg');
      expect(readme).toContain('> Test package');
      expect(readme).toContain('## Installation');
      expect(readme).toContain('## Quick Start');
      expect(readme).toContain('## Documentation');
      expect(readme).toContain('### Getting Started');
      expect(readme).toContain('- [Installation](docs/getting-started/install.md)');
      expect(readme).toContain('- [Quick Start](docs/getting-started/quick-start.md)');
      expect(readme).toContain('## License');

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('includes quick start code only for core package', () => {
      const tmpDir = path.join(__dirname, '../tmp/test-readme-core');
      fs.mkdirSync(path.join(tmpDir, 'docs/getting-started'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ name: '@witqq/spreadsheet', description: 'Core engine' }),
      );

      const coreReadme = generateNavigatorReadme(tmpDir, 'core', '@witqq/spreadsheet', 'Core engine');
      expect(coreReadme).toContain('SpreadsheetEngine');
      expect(coreReadme).toContain("import { SpreadsheetEngine }");

      const reactReadme = generateNavigatorReadme(tmpDir, 'react', '@witqq/spreadsheet-react', 'React wrapper');
      expect(reactReadme).not.toContain('SpreadsheetEngine');

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe('generateForPackage (integration)', () => {
    it('generates docs and README for core package', () => {
      const result = generateForPackage('core');

      expect(result.name).toBe('core');
      expect(result.converted).toBeGreaterThanOrEqual(50);
      expect(result.skipped).toBe(0);
      expect(result.errors).toEqual([]);
      expect(result.readmeGenerated).toBe(true);

      // Verify README was actually written
      const readme = fs.readFileSync(
        path.join(__dirname, '../packages/core/README.md'),
        'utf-8',
      );
      expect(readme).toContain('## Documentation');
      expect(readme).toContain('docs/guides/sorting.md');
    });

    it('generates filtered docs for react package', () => {
      const result = generateForPackage('react');

      expect(result.name).toBe('react');
      expect(result.converted).toBeGreaterThanOrEqual(6);
      expect(result.skipped).toBeGreaterThan(0);
      expect(result.errors).toEqual([]);
      expect(result.readmeGenerated).toBe(true);

      // Should have react framework doc but not vue
      const docsDir = path.join(__dirname, '../packages/react/docs');
      expect(fs.existsSync(path.join(docsDir, 'frameworks/react.md'))).toBe(true);
      expect(fs.existsSync(path.join(docsDir, 'frameworks/vue.md'))).toBe(false);
      expect(fs.existsSync(path.join(docsDir, 'guides'))).toBe(false);
    });
  });
});
