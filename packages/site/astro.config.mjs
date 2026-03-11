// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightClientMermaid from '@pasqal-io/starlight-client-mermaid';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://spreadsheet.witqq.dev',
  integrations: [
    starlight({
      title: '@witqq/spreadsheet',
      description: 'Canvas spreadsheet engine for the web',
      plugins: [starlightClientMermaid()],
      components: {
        Footer: './src/components/overrides/Footer.astro',
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/witqq/spreadsheet' },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', slug: 'getting-started' },
            { label: 'Performance — 1M Rows', slug: 'getting-started/performance' },
            { label: 'Installation', slug: 'getting-started/installation' },
            { label: 'Quick Start', slug: 'getting-started/quick-start' },
            { label: 'Configuration', slug: 'getting-started/configuration' },
            { label: 'TypeScript', slug: 'getting-started/typescript' },
            { label: 'Features Overview', slug: 'guides/features' },
          ],
        },
        {
          label: 'Core Concepts',
          items: [
            { label: 'Architecture', slug: 'concepts/architecture' },
            { label: 'Data Model', slug: 'concepts/data-model' },
            { label: 'Rendering Pipeline', slug: 'concepts/rendering' },
            { label: 'Event System', slug: 'concepts/events' },
            { label: 'Themes & Styling', slug: 'concepts/themes' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Selection & Navigation', slug: 'guides/selection' },
            { label: 'Cell Editing', slug: 'guides/editing' },
            { label: 'Sorting', slug: 'guides/sorting' },
            { label: 'Filtering', slug: 'guides/filtering' },
            { label: 'Frozen Panes', slug: 'guides/frozen-panes' },
            { label: 'Cell Merging', slug: 'guides/merging' },
            { label: 'Clipboard', slug: 'guides/clipboard' },
            { label: 'Undo & Redo', slug: 'guides/undo-redo' },
            { label: 'Column & Row Resize', slug: 'guides/resize' },
            { label: 'Auto Row Height', slug: 'guides/auto-row-height' },
            { label: 'Text Wrapping', slug: 'guides/text-wrapping' },
            { label: 'Per-Cell Styling', slug: 'guides/styling' },
            { label: 'Cell Decorators', slug: 'guides/decorators' },
            { label: 'Column Stretch', slug: 'guides/column-stretch' },
            { label: 'Autofill', slug: 'guides/autofill' },
            { label: 'Change Tracking', slug: 'guides/change-tracking' },
            { label: 'Validation', slug: 'guides/validation' },
            { label: 'Context Menu', slug: 'guides/context-menu' },
            { label: 'Date & DateTime Editors', slug: 'guides/date-editors' },
            { label: 'Cell Editor Registry', slug: 'guides/cell-editor-registry' },
            { label: 'Locale System', slug: 'guides/locale' },
            { label: 'Accessibility', slug: 'guides/accessibility' },
            { label: 'Print Support', slug: 'guides/print' },
            { label: 'Streaming Data', slug: 'guides/streaming' },
            { label: 'Pivot Tables', slug: 'guides/pivot' },
            { label: 'Row Grouping', slug: 'guides/row-grouping' },
            { label: 'DataView', slug: 'guides/dataview' },
            { label: 'Migration from Handsontable', slug: 'guides/migration-from-handsontable' },
          ],
        },
        {
          label: 'Plugins',
          items: [
            { label: 'Plugin System', slug: 'plugins/overview' },
            { label: 'Formula Engine', slug: 'plugins/formulas' },
            { label: 'Custom Functions', slug: 'plugins/custom-functions' },
            { label: 'Conditional Formatting', slug: 'plugins/conditional-format' },
            { label: 'Excel Import/Export', slug: 'plugins/excel' },
            { label: 'Collaboration', slug: 'plugins/collaboration' },
            { label: 'Progressive Loader', slug: 'plugins/progressive-loader' },
          ],
        },
        {
          label: 'API Reference',
          items: [
            { label: 'WitEngine', slug: 'api/wit-engine' },
            { label: 'Core Types', slug: 'api/types' },
            { label: 'Cell Types', slug: 'api/cell-types' },
          ],
        },
        {
          label: 'Frameworks',
          items: [
            { label: 'React', slug: 'frameworks/react' },
            { label: 'Vue 3', slug: 'frameworks/vue' },
            { label: 'Angular', slug: 'frameworks/angular' },
            { label: 'Vanilla JS / Widget', slug: 'frameworks/widget' },
          ],
        },
      ],
    }),
    react(),
    sitemap(),
  ],
});
