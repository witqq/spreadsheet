import type { ComponentType } from 'react';
import { BasicDefault } from './scenarios/basic-default';
import { BasicEmpty } from './scenarios/basic-empty';
import { BasicSingleRow } from './scenarios/basic-single-row';
import { BasicLargeDataset } from './scenarios/basic-large-dataset';
import { ColumnsNarrow } from './scenarios/columns-narrow';
import { ColumnsWide } from './scenarios/columns-wide';
import { ColumnsMixed } from './scenarios/columns-mixed';
import { CellTypesAll } from './scenarios/cell-types-all';
import { ContainerTiny } from './scenarios/container-tiny';
import { ContainerSmall } from './scenarios/container-small';
import { ContainerMedium } from './scenarios/container-medium';
import { ContainerLarge } from './scenarios/container-large';
import { FrozenPanes } from './scenarios/frozen-panes';
import { DarkTheme } from './scenarios/dark-theme';
import { LongText } from './scenarios/long-text';
import { NoRowNumbers } from './scenarios/no-row-numbers';
import { CustomRowHeight } from './scenarios/custom-row-height';
import { ManyColumns } from './scenarios/many-columns';
import { MergedCells } from './scenarios/merged-cells';
import { SortedFiltered } from './scenarios/sorted-filtered';
import { Selections } from './scenarios/selections';
import { ScrollStates } from './scenarios/scroll-states';
import { ValidationErrors } from './scenarios/validation-errors';
import { DemoFrozenPanes } from './scenarios/demo-frozen-panes';
import { DemoMerging } from './scenarios/demo-merging';
import { DemoClipboard } from './scenarios/demo-clipboard';
import { DemoUndoRedo } from './scenarios/demo-undo-redo';
import { DemoResize } from './scenarios/demo-resize';
import { DemoAutofill } from './scenarios/demo-autofill';
import { DemoChangeTracking } from './scenarios/demo-change-tracking';
import { DemoValidation } from './scenarios/demo-validation';
import { DemoContextMenu } from './scenarios/demo-context-menu';
import { DemoThemeSwitcher } from './scenarios/demo-theme-switcher';
import { DemoAccessibility } from './scenarios/demo-accessibility';
import { DemoPrint } from './scenarios/demo-print';
import { DemoCellTypes } from './scenarios/demo-cell-types';
import { DemoRowGrouping } from './scenarios/demo-row-grouping';
import { DemoFormula } from './scenarios/demo-formula';
import { DemoConditionalFormat } from './scenarios/demo-conditional-format';
import { DemoExcel } from './scenarios/demo-excel';
import { DemoEventBus } from './scenarios/demo-event-bus';
import { DemoPluginShowcase } from './scenarios/demo-plugin-showcase';
import { DemoHero } from './scenarios/demo-hero';
import { DemoDecorators } from './scenarios/demo-decorators';

export interface Scenario {
  id: string;
  description: string;
  component: ComponentType;
}

export const scenarios: Scenario[] = [
  {
    id: 'basic-default',
    description: 'Default table (7 columns, 50 rows)',
    component: BasicDefault,
  },
  { id: 'basic-empty', description: 'Empty table (0 data rows)', component: BasicEmpty },
  { id: 'basic-single-row', description: 'Single data row', component: BasicSingleRow },
  {
    id: 'basic-large-dataset',
    description: 'Large dataset (1000 rows)',
    component: BasicLargeDataset,
  },
  {
    id: 'columns-narrow',
    description: 'Very narrow columns (40px each)',
    component: ColumnsNarrow,
  },
  { id: 'columns-wide', description: 'Very wide columns (400px each)', component: ColumnsWide },
  { id: 'columns-mixed', description: 'Mixed narrow and wide columns', component: ColumnsMixed },
  { id: 'cell-types-all', description: 'All built-in cell types', component: CellTypesAll },
  { id: 'container-tiny', description: 'Tiny container (300×200)', component: ContainerTiny },
  { id: 'container-small', description: 'Small container (400×300)', component: ContainerSmall },
  { id: 'container-medium', description: 'Medium container (800×500)', component: ContainerMedium },
  { id: 'container-large', description: 'Large container (1200×700)', component: ContainerLarge },
  { id: 'frozen-panes', description: 'Frozen 2 rows + 1 column', component: FrozenPanes },
  { id: 'dark-theme', description: 'Dark theme rendering', component: DarkTheme },
  { id: 'long-text', description: 'Long text with truncation', component: LongText },
  { id: 'no-row-numbers', description: 'Row numbers hidden', component: NoRowNumbers },
  { id: 'custom-row-height', description: 'Non-default row heights', component: CustomRowHeight },
  { id: 'many-columns', description: '30+ columns in view', component: ManyColumns },
  {
    id: 'merged-cells',
    description: 'Several merged regions of different sizes',
    component: MergedCells,
  },
  {
    id: 'sorted-filtered',
    description: 'Sorted ascending with active filter',
    component: SortedFiltered,
  },
  { id: 'selections', description: 'Range selection (rows 2-5, cols 1-3)', component: Selections },
  {
    id: 'scroll-states',
    description: 'Scrolled right and down (partial columns)',
    component: ScrollStates,
  },
  {
    id: 'validation-errors',
    description: 'Cells with validation errors visible',
    component: ValidationErrors,
  },
  {
    id: 'demo-frozen-panes',
    description: 'Demo: frozen rows and columns',
    component: DemoFrozenPanes,
  },
  { id: 'demo-merging', description: 'Demo: merged cell regions', component: DemoMerging },
  {
    id: 'demo-clipboard',
    description: 'Demo: editable table for clipboard',
    component: DemoClipboard,
  },
  {
    id: 'demo-undo-redo',
    description: 'Demo: editable table with undo/redo',
    component: DemoUndoRedo,
  },
  {
    id: 'demo-resize',
    description: 'Demo: resizable columns with constraints',
    component: DemoResize,
  },
  { id: 'demo-autofill', description: 'Demo: autofill sequences', component: DemoAutofill },
  {
    id: 'demo-change-tracking',
    description: 'Demo: cell status indicators',
    component: DemoChangeTracking,
  },
  {
    id: 'demo-validation',
    description: 'Demo: validation rules and errors',
    component: DemoValidation,
  },
  { id: 'demo-context-menu', description: 'Demo: context menu table', component: DemoContextMenu },
  { id: 'demo-theme-switcher', description: 'Demo: dark theme', component: DemoThemeSwitcher },
  { id: 'demo-accessibility', description: 'Demo: accessible table', component: DemoAccessibility },
  { id: 'demo-print', description: 'Demo: print-ready table', component: DemoPrint },
  {
    id: 'demo-cell-types',
    description: 'Demo: custom cell type renderers',
    component: DemoCellTypes,
  },
  {
    id: 'demo-row-grouping',
    description: 'Demo: grouped rows with aggregates',
    component: DemoRowGrouping,
  },
  { id: 'demo-formula', description: 'Demo: formula plugin (A+B, A×B)', component: DemoFormula },
  {
    id: 'demo-conditional-format',
    description: 'Demo: conditional formatting gradient',
    component: DemoConditionalFormat,
  },
  { id: 'demo-excel', description: 'Demo: Excel-exportable table', component: DemoExcel },
  { id: 'demo-event-bus', description: 'Demo: event bus table', component: DemoEventBus },
  {
    id: 'demo-plugin-showcase',
    description: 'Demo: plugin showcase table',
    component: DemoPluginShowcase,
  },
  { id: 'demo-hero', description: 'Demo: hero business data table', component: DemoHero },
  {
    id: 'demo-decorators',
    description: 'Demo: cell decorators (tree, sort, progress, link, spinner)',
    component: DemoDecorators,
  },
];
