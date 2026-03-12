/**
 * generate-npm-docs.ts
 *
 * Converts site .mdx documentation files into clean markdown
 * for inclusion in npm packages under docs/ directories.
 *
 * Usage:
 *   npx tsx scripts/generate-npm-docs.ts                  # all packages
 *   npx tsx scripts/generate-npm-docs.ts --package core   # specific package
 *   npx tsx scripts/generate-npm-docs.ts --output-dir dir # custom output dir
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SITE_DOCS_DIR = path.join(ROOT, 'packages/site/src/content/docs');
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'packages/core/docs');
const SITE_BASE_URL = 'https://spreadsheet.witqq.dev';

// ─── Per-package doc filter configuration ───────────────────

export type PackageName =
  | 'core'
  | 'react'
  | 'vue'
  | 'angular'
  | 'widget'
  | 'plugins';

/**
 * Defines which doc directories/files each package includes.
 * Paths are relative to the site docs root (e.g. "getting-started/", "frameworks/react.mdx").
 * A trailing "/" means include all files in that directory.
 * core gets everything (null = no filter).
 */
export const PACKAGE_DOC_FILTERS: Record<PackageName, string[] | null> = {
  core: null,
  react: [
    'getting-started/',
    'frameworks/react.mdx',
  ],
  vue: [
    'getting-started/',
    'frameworks/vue.mdx',
  ],
  angular: [
    'getting-started/',
    'frameworks/angular.mdx',
  ],
  widget: [
    'getting-started/',
    'frameworks/widget.mdx',
  ],
  plugins: [
    'getting-started/',
    'plugins/',
  ],
};

const PACKAGE_DIRS: Record<PackageName, string> = {
  core: path.join(ROOT, 'packages/core'),
  react: path.join(ROOT, 'packages/react'),
  vue: path.join(ROOT, 'packages/vue'),
  angular: path.join(ROOT, 'packages/angular'),
  widget: path.join(ROOT, 'packages/widget'),
  plugins: path.join(ROOT, 'packages/plugins'),
};

export function matchesFilter(
  mdxRelativePath: string,
  filters: string[] | null,
): boolean {
  if (filters === null) return true;
  const normalized = mdxRelativePath.replace(/\\/g, '/');
  return filters.some((f) => {
    if (f.endsWith('/')) return normalized.startsWith(f);
    return normalized === f;
  });
}

// ─── Frontmatter ────────────────────────────────────────────

export function extractFrontmatter(content: string): {
  title: string;
  description: string;
  rest: string;
  isSplash: boolean;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { title: '', description: '', rest: content, isSplash: false };

  const frontmatter = match[1];
  const rest = match[2];

  const titleMatch = frontmatter.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  const descMatch = frontmatter.match(/^description:\s*["']?(.+?)["']?\s*$/m);
  const isSplash = /template:\s*splash/.test(frontmatter);

  return {
    title: titleMatch?.[1] ?? '',
    description: descMatch?.[1] ?? '',
    rest,
    isSplash,
  };
}

// ─── Import resolution ──────────────────────────────────────

interface RawImport {
  variableName: string;
  filePath: string;
}

export function parseImports(content: string): {
  rawImports: RawImport[];
  cleaned: string;
} {
  // Protect fenced code blocks from import stripping
  const codeBlocks: string[] = [];
  let safeContent = content.replace(
    /^```[\s\S]*?^```/gm,
    (match) => {
      codeBlocks.push(match);
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    },
  );

  const rawImports: RawImport[] = [];
  safeContent = safeContent.replace(
    /^import\s+.*?\s+from\s+['"].*?['"];?\s*\n?/gm,
    (line) => {
      const rawMatch = line.match(
        /import\s+(\w+)\s+from\s+['"](.+?)\?raw['"];?/,
      );
      if (rawMatch) {
        rawImports.push({
          variableName: rawMatch[1],
          filePath: rawMatch[2],
        });
      }
      return '';
    },
  );

  // Restore code blocks
  const cleaned = safeContent.replace(
    /__CODE_BLOCK_(\d+)__/g,
    (_, idx) => codeBlocks[Number(idx)],
  );

  return { rawImports, cleaned };
}

export function resolveRawImport(
  rawImport: RawImport,
  mdxFilePath: string,
): string | null {
  const mdxDir = path.dirname(mdxFilePath);
  const resolved = path.resolve(mdxDir, rawImport.filePath);

  try {
    return fs.readFileSync(resolved, 'utf-8');
  } catch {
    return null;
  }
}

// ─── JSX → Markdown conversion ──────────────────────────────

export function convertDemoComponent(
  content: string,
  slug: string,
): string {
  const demoUrl = `${SITE_BASE_URL}/${slug}/`;
  let emittedLink = false;
  // Replace <ComponentName client:visible /> — emit link only once per page
  return content.replace(
    /^<(\w+)(?:\s+[\w{}=]+)*\s+client:visible\s*\/?>\s*$/gm,
    () => {
      if (emittedLink) return '';
      emittedLink = true;
      return `> **Live Demo**: [Open interactive demo](${demoUrl})\n`;
    },
  );
}

export function convertCodeComponent(
  content: string,
  rawImports: RawImport[],
  mdxFilePath: string,
): string {
  // Match <Code code={varName} lang="xxx" title="yyy" /> (self-closing or not)
  return content.replace(
    /<Code\s+code=\{(\w+)\}\s+lang="(\w+)"(?:\s+title="([^"]*)")?\s*\/>/g,
    (_match, varName: string, lang: string, title?: string) => {
      const rawImport = rawImports.find((r) => r.variableName === varName);
      if (!rawImport) return _match;

      const source = resolveRawImport(rawImport, mdxFilePath);
      if (!source) return `\`\`\`${lang}\n// Source file not found\n\`\`\``;

      const header = title ? `\`\`\`${lang} title="${title}"` : `\`\`\`${lang}`;
      return `${header}\n${source.trimEnd()}\n\`\`\``;
    },
  );
}

export function stripRemainingJsx(content: string): string {
  // Remove self-closing JSX tags that weren't handled
  let result = content.replace(/^<\w+[^>]*\/>\s*$/gm, '');
  // Remove JSX opening/closing tag pairs on single lines (but not HTML like <details>)
  const htmlTags = new Set([
    'details',
    'summary',
    'div',
    'span',
    'p',
    'br',
    'hr',
    'a',
    'img',
    'table',
    'thead',
    'tbody',
    'tr',
    'td',
    'th',
    'ul',
    'ol',
    'li',
    'blockquote',
    'pre',
    'code',
    'em',
    'strong',
    'b',
    'i',
    'sup',
    'sub',
  ]);
  result = result.replace(
    /^<(\w+)[^>]*>.*<\/\1>\s*$/gm,
    (match, tagName: string) => {
      if (htmlTags.has(tagName.toLowerCase())) return match;
      return '';
    },
  );
  return result;
}

export function cleanupEmptyLines(content: string): string {
  return content.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// ─── Slug computation ───────────────────────────────────────

export function computeSlug(mdxFilePath: string): string {
  const relative = path.relative(SITE_DOCS_DIR, mdxFilePath);
  let slug = relative.replace(/\.mdx$/, '').replace(/\\/g, '/');
  // index files map to parent directory
  if (slug.endsWith('/index')) {
    slug = slug.replace(/\/index$/, '');
  } else if (slug === 'index') {
    slug = '';
  }
  return slug;
}

// ─── Output path computation ────────────────────────────────

export function computeOutputPath(
  mdxFilePath: string,
  outputDir: string,
): string {
  const relative = path.relative(SITE_DOCS_DIR, mdxFilePath);
  const mdPath = relative.replace(/\.mdx$/, '.md').replace(/\\/g, '/');
  return path.join(outputDir, mdPath);
}

// ─── Full file conversion ───────────────────────────────────

export function convertMdxToMd(
  mdxContent: string,
  mdxFilePath: string,
): string {
  const { title, description, rest, isSplash } =
    extractFrontmatter(mdxContent);

  // Splash pages get simplified treatment
  if (isSplash) {
    let output = '';
    if (title) output += `# ${title}\n\n`;
    if (description) output += `${description}\n\n`;
    const body = rest.trim();
    if (body) output += body + '\n';
    return cleanupEmptyLines(output);
  }

  const slug = computeSlug(mdxFilePath);
  const { rawImports, cleaned } = parseImports(rest);

  let result = cleaned;

  // Add title as heading only if content doesn't already start with an H1
  if (title) {
    const trimmed = result.trimStart();
    const hasExistingH1 = /^#\s+.+\n/.test(trimmed);
    if (!hasExistingH1) {
      result = `# ${title}\n\n${result}`;
    }
  }

  // Convert demo components to links
  result = convertDemoComponent(result, slug);

  // Convert <Code> components to fenced code blocks
  result = convertCodeComponent(result, rawImports, mdxFilePath);

  // Strip remaining JSX
  result = stripRemainingJsx(result);

  // Clean up
  result = cleanupEmptyLines(result);

  return result;
}

// ─── Directory processing ───────────────────────────────────

function collectMdxFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMdxFiles(fullPath));
    } else if (entry.name.endsWith('.mdx')) {
      files.push(fullPath);
    }
  }
  return files;
}

export function generateDocs(
  outputDir: string = DEFAULT_OUTPUT_DIR,
  filter: string[] | null = null,
): {
  converted: number;
  skipped: number;
  errors: string[];
} {
  const mdxFiles = collectMdxFiles(SITE_DOCS_DIR);
  const errors: string[] = [];
  let converted = 0;
  let skipped = 0;

  // Clean output directory
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true });
  }

  for (const mdxFile of mdxFiles) {
    const rel = path.relative(SITE_DOCS_DIR, mdxFile).replace(/\\/g, '/');
    if (!matchesFilter(rel, filter)) {
      skipped++;
      continue;
    }

    try {
      const content = fs.readFileSync(mdxFile, 'utf-8');
      const md = convertMdxToMd(content, mdxFile);
      const outPath = computeOutputPath(mdxFile, outputDir);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, md, 'utf-8');
      converted++;
    } catch (err) {
      errors.push(
        `${rel}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { converted, skipped, errors };
}

// ─── Navigator README generation ────────────────────────────

interface TocEntry {
  title: string;
  path: string;
}

interface TocSection {
  heading: string;
  entries: TocEntry[];
}

const SECTION_ORDER = [
  'getting-started',
  'concepts',
  'guides',
  'plugins',
  'api',
  'frameworks',
];

const SECTION_NAMES: Record<string, string> = {
  'getting-started': 'Getting Started',
  concepts: 'Core Concepts',
  guides: 'Guides',
  plugins: 'Plugins',
  api: 'API Reference',
  frameworks: 'Frameworks',
};

function extractTitleFromMd(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const h1 = content.match(/^#\s+(.+)$/m);
    if (h1) return h1[1];
  } catch { /* empty */ }
  // Fallback: humanize filename
  const name = path.basename(filePath, '.md');
  return name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildToc(docsDir: string): TocSection[] {
  const sections: TocSection[] = [];
  for (const sectionDir of SECTION_ORDER) {
    const fullDir = path.join(docsDir, sectionDir);
    if (!fs.existsSync(fullDir)) continue;

    const entries: TocEntry[] = [];
    const files = fs.readdirSync(fullDir).filter((f) => f.endsWith('.md')).sort();
    for (const file of files) {
      const filePath = path.join(fullDir, file);
      const title = extractTitleFromMd(filePath);
      entries.push({ title, path: `docs/${sectionDir}/${file}` });
    }

    if (entries.length > 0) {
      sections.push({
        heading: SECTION_NAMES[sectionDir] ?? sectionDir,
        entries,
      });
    }
  }
  return sections;
}

export function generateNavigatorReadme(
  packageDir: string,
  packageName: string,
  npmName: string,
  description: string,
  peerDependencies: Record<string, string> = {},
  dependencies: Record<string, string> = {},
): string {
  const docsDir = path.join(packageDir, 'docs');
  const toc = buildToc(docsDir);

  const lines: string[] = [];
  lines.push(`# ${npmName}`);
  lines.push('');
  lines.push(`> ${description}`);
  lines.push('');
  lines.push(
    `[![npm version](https://img.shields.io/npm/v/${npmName}.svg)](https://www.npmjs.com/package/${npmName})`,
  );
  lines.push(
    `[![license](https://img.shields.io/npm/l/${npmName}.svg)](https://github.com/witqq/spreadsheet/blob/master/LICENSE)`,
  );
  lines.push('');
  lines.push('## Installation');
  lines.push('');
  lines.push('```bash');
  lines.push(`npm install ${npmName}`);
  lines.push('```');
  lines.push('');

  // Show peer dependencies for non-core packages
  const peerDepNames = Object.keys(peerDependencies);
  if (peerDepNames.length > 0) {
    lines.push('**Peer dependencies:**');
    lines.push('');
    for (const [dep, version] of Object.entries(peerDependencies)) {
      lines.push(`- \`${dep}\` ${version}`);
    }
    lines.push('');
  }

  // Note @witqq/spreadsheet as required dependency if not core
  if (packageName !== 'core' && dependencies['@witqq/spreadsheet']) {
    lines.push(`Requires [\`@witqq/spreadsheet\`](https://www.npmjs.com/package/@witqq/spreadsheet) (installed automatically).`);
    lines.push('');
  }

  if (packageName === 'core') {
    lines.push('## Quick Start');
    lines.push('');
    lines.push('```typescript');
    lines.push("import { SpreadsheetEngine } from '@witqq/spreadsheet';");
    lines.push("import type { ColumnDef } from '@witqq/spreadsheet';");
    lines.push('');
    lines.push('const columns: ColumnDef[] = [');
    lines.push("  { key: 'name', title: 'Name', width: 150 },");
    lines.push("  { key: 'age', title: 'Age', width: 80, type: 'number' },");
    lines.push("  { key: 'email', title: 'Email', width: 200 },");
    lines.push('];');
    lines.push('');
    lines.push('const data = [');
    lines.push("  { name: 'Alice', age: 30, email: 'alice@example.com' },");
    lines.push("  { name: 'Bob', age: 25, email: 'bob@example.com' },");
    lines.push('];');
    lines.push('');
    lines.push('const engine = new SpreadsheetEngine({ columns, data });');
    lines.push("engine.mount(document.getElementById('grid')!);");
    lines.push('```');
    lines.push('');
  }

  // Table of contents
  if (toc.length > 0) {
    lines.push('## Documentation');
    lines.push('');
    lines.push(
      `Full documentation is available at [spreadsheet.witqq.dev](${SITE_BASE_URL}) and included in this package under \`docs/\`.`,
    );
    lines.push('');

    for (const section of toc) {
      lines.push(`### ${section.heading}`);
      lines.push('');
      for (const entry of section.entries) {
        lines.push(`- [${entry.title}](${entry.path})`);
      }
      lines.push('');
    }
  }

  lines.push('## License');
  lines.push('');
  lines.push('BUSL-1.1');
  lines.push('');

  return lines.join('\n');
}

// ─── Multi-package generation ───────────────────────────────

interface PackageResult {
  name: PackageName;
  converted: number;
  skipped: number;
  errors: string[];
  readmeGenerated: boolean;
}

function readPackageJson(packageDir: string): {
  name: string;
  description: string;
  peerDependencies: Record<string, string>;
  dependencies: Record<string, string>;
} {
  const pkgPath = path.join(packageDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  return {
    name: pkg.name ?? '',
    description: pkg.description ?? '',
    peerDependencies: pkg.peerDependencies ?? {},
    dependencies: pkg.dependencies ?? {},
  };
}

export function generateForPackage(pkgName: PackageName): PackageResult {
  const pkgDir = PACKAGE_DIRS[pkgName];
  const filter = PACKAGE_DOC_FILTERS[pkgName];
  const docsDir = path.join(pkgDir, 'docs');

  const { converted, skipped, errors } = generateDocs(docsDir, filter);

  // Generate navigator README only if docs were produced
  let readmeGenerated = false;
  if (converted > 0) {
    const { name: npmName, description, peerDependencies, dependencies } = readPackageJson(pkgDir);
    const readme = generateNavigatorReadme(
      pkgDir, pkgName, npmName, description, peerDependencies, dependencies,
    );
    fs.writeFileSync(path.join(pkgDir, 'README.md'), readme, 'utf-8');
    readmeGenerated = true;
  }

  return { name: pkgName, converted, skipped, errors, readmeGenerated };
}

export function generateForAllPackages(): PackageResult[] {
  const results: PackageResult[] = [];
  for (const pkgName of Object.keys(PACKAGE_DOC_FILTERS) as PackageName[]) {
    results.push(generateForPackage(pkgName));
  }
  return results;
}

// ─── CLI entry point ────────────────────────────────────────

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const args = process.argv.slice(2);
  const outputDirIdx = args.indexOf('--output-dir');
  const packageIdx = args.indexOf('--package');

  console.log(`Generating npm docs from ${SITE_DOCS_DIR}\n`);

  // Mode 1: --output-dir (legacy, generates all docs to a single dir)
  if (outputDirIdx !== -1) {
    const outputDir = args[outputDirIdx + 1];
    if (!outputDir) {
      console.error('Missing value for --output-dir');
      process.exit(1);
    }
    const { converted, errors } = generateDocs(outputDir);
    console.log(`✓ Converted ${converted} files → ${outputDir}`);
    if (errors.length > 0) {
      console.error(`\n✗ ${errors.length} errors:`);
      errors.forEach((e) => console.error(`  - ${e}`));
      process.exit(1);
    }
  }
  // Mode 2: --package <name> (generate for specific package)
  else if (packageIdx !== -1) {
    const pkgName = args[packageIdx + 1] as PackageName;
    if (!pkgName || !PACKAGE_DOC_FILTERS[pkgName]) {
      console.error(`Unknown package: ${pkgName ?? '(missing)'}`);
      console.error(`Available: ${Object.keys(PACKAGE_DOC_FILTERS).join(', ')}`);
      process.exit(1);
    }
    const result = generateForPackage(pkgName);
    console.log(
      `✓ ${result.name}: ${result.converted} files, ${result.skipped} skipped, README ${result.readmeGenerated ? 'generated' : 'skipped'}`,
    );
    if (result.errors.length > 0) {
      console.error(`\n✗ ${result.errors.length} errors:`);
      result.errors.forEach((e) => console.error(`  - ${e}`));
      process.exit(1);
    }
  }
  // Mode 3: no args (generate for all packages)
  else {
    const results = generateForAllPackages();
    let totalErrors = 0;
    for (const r of results) {
      console.log(
        `✓ ${r.name}: ${r.converted} files, ${r.skipped} skipped, README ${r.readmeGenerated ? 'generated' : 'skipped'}`,
      );
      totalErrors += r.errors.length;
    }
    if (totalErrors > 0) {
      console.error(`\n✗ ${totalErrors} total errors:`);
      for (const r of results) {
        r.errors.forEach((e) => console.error(`  - [${r.name}] ${e}`));
      }
      process.exit(1);
    }
  }
}
