// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type {
  SpreadsheetPlugin,
  PluginAPI,
  CellDecoratorRegistration,
  CellData,
  CellEvent,
} from '@witqq/spreadsheet';

import { TreeExpanderDecorator, TREE_TOGGLE_HIT_ZONE } from './tree-expander-decorator';
import { SortIconDecorator, SORT_HIT_ZONE } from './sort-icon-decorator';
import { ProgressBarDecorator, type ProgressBarOptions } from './progress-bar-decorator';
import { LinkDecorator, LINK_HIT_ZONE } from './link-decorator';
import { ImageDecorator, type ImageDecoratorOptions } from './image-decorator';
import { SpinnerDecorator } from './spinner-decorator';

export const DECORATORS_PLUGIN_NAME = 'decorators';

export interface DecoratorsPluginConfig {
  /** Enable tree expander. Default: true */
  treeExpander?: boolean;
  /** Enable sort icon. Default: true */
  sortIcon?: boolean;
  /** Enable progress bar. Default: true */
  progressBar?: boolean | ProgressBarOptions;
  /** Enable link decorator. Default: true */
  link?: boolean;
  /** Enable image thumbnail. Default: true */
  image?: boolean | ImageDecoratorOptions;
  /** Enable spinner. Default: true */
  spinner?: boolean;
}

type EventHandler = (...args: unknown[]) => void;

/**
 * Built-in decorators plugin that bundles six reusable cell decorators.
 *
 * Decorators:
 * - **TreeExpander** (left): expand/collapse toggle with indentation
 * - **SortIcon** (right): sort direction indicator
 * - **ProgressBar** (underlay): percentage bar behind cell text
 * - **Link** (overlay): clickable URL icon
 * - **Image** (left): thumbnail using ImageManager
 * - **Spinner** (overlay, animated): loading spinner
 */
export class DecoratorsPlugin implements SpreadsheetPlugin {
  readonly name = DECORATORS_PLUGIN_NAME;
  readonly version = '1.0.0';

  private api: PluginAPI | null = null;
  private registeredIds: string[] = [];
  private clickHandler: EventHandler | null = null;
  private config: Required<{
    treeExpander: boolean;
    sortIcon: boolean;
    progressBar: boolean | ProgressBarOptions;
    link: boolean;
    image: boolean | ImageDecoratorOptions;
    spinner: boolean;
  }>;

  constructor(config: DecoratorsPluginConfig = {}) {
    this.config = {
      treeExpander: config.treeExpander ?? true,
      sortIcon: config.sortIcon ?? true,
      progressBar: config.progressBar ?? true,
      link: config.link ?? true,
      image: config.image ?? true,
      spinner: config.spinner ?? true,
    };
  }

  install(api: PluginAPI): void {
    this.api = api;
    const registry = api.engine.getCellTypeRegistry();

    if (this.config.treeExpander) {
      const decorator = new TreeExpanderDecorator();
      const reg: CellDecoratorRegistration = {
        decorator,
        appliesTo: (_row: number, _col: number, cellData: CellData) =>
          cellData.metadata?.treeLevel != null,
      };
      registry.addDecorator(reg);
      this.registeredIds.push(decorator.id);
    }

    if (this.config.sortIcon) {
      const decorator = new SortIconDecorator();
      const reg: CellDecoratorRegistration = {
        decorator,
        appliesTo: (_row: number, _col: number, cellData: CellData) =>
          cellData.metadata?.sortDirection != null &&
          cellData.metadata.sortDirection !== 'none',
      };
      registry.addDecorator(reg);
      this.registeredIds.push(decorator.id);
    }

    if (this.config.progressBar) {
      const options = typeof this.config.progressBar === 'object'
        ? this.config.progressBar
        : {};
      const decorator = new ProgressBarDecorator(options);
      const reg: CellDecoratorRegistration = {
        decorator,
        appliesTo: (_row: number, _col: number, cellData: CellData) => {
          const progress = cellData.metadata?.progress;
          return typeof progress === 'number' && progress > 0;
        },
      };
      registry.addDecorator(reg);
      this.registeredIds.push(decorator.id);
    }

    if (this.config.link) {
      const decorator = new LinkDecorator();
      const reg: CellDecoratorRegistration = {
        decorator,
        appliesTo: (_row: number, _col: number, cellData: CellData) => {
          const link = cellData.metadata?.link;
          return link != null && typeof link === 'object' && 'url' in link &&
            typeof link.url === 'string' && link.url.length > 0;
        },
      };
      registry.addDecorator(reg);
      this.registeredIds.push(decorator.id);
    }

    if (this.config.image) {
      const options = typeof this.config.image === 'object'
        ? this.config.image
        : {};
      const decorator = new ImageDecorator(options);
      const urlField = options.urlField ?? 'imageUrl';

      // Wire ImageManager from the engine
      const imageManager = api.engine.getImageManager();
      decorator.setImageManager(imageManager);

      const reg: CellDecoratorRegistration = {
        decorator,
        appliesTo: (_row: number, _col: number, cellData: CellData) => {
          const meta = cellData.metadata;
          if (!meta) return false;
          const val = meta[urlField];
          return typeof val === 'string' && val.length > 0;
        },
      };
      registry.addDecorator(reg);
      this.registeredIds.push(decorator.id);
    }

    if (this.config.spinner) {
      const decorator = new SpinnerDecorator();
      const reg: CellDecoratorRegistration = {
        decorator,
        appliesTo: (_row: number, _col: number, cellData: CellData) =>
          cellData.metadata?.loading === true,
        animated: true,
      };
      registry.addDecorator(reg);
      this.registeredIds.push(decorator.id);
    }

    // Wire up click handlers for interactive decorators
    this.clickHandler = (event: unknown) => {
      const cellEvent = event as CellEvent;
      if (!cellEvent.hitZone) return;

      const eventBus = api.engine.getEventBus();
      if (cellEvent.hitZone === TREE_TOGGLE_HIT_ZONE) {
        eventBus.emit('treeToggle', cellEvent);
      } else if (cellEvent.hitZone === SORT_HIT_ZONE) {
        eventBus.emit('sortRequest', cellEvent);
      } else if (cellEvent.hitZone === LINK_HIT_ZONE) {
        eventBus.emit('linkClick', cellEvent);
      }
    };
    api.engine.on('cellClick', this.clickHandler as never);

    api.engine.requestRender();
  }

  destroy(): void {
    if (!this.api) return;

    const registry = this.api.engine.getCellTypeRegistry();
    for (const id of this.registeredIds) {
      registry.removeDecorator(id);
    }
    this.registeredIds = [];

    if (this.clickHandler) {
      this.api.engine.off('cellClick', this.clickHandler as never);
      this.clickHandler = null;
    }

    this.api.engine.requestRender();
    this.api = null;
  }
}
