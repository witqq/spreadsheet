// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * FilterPanel — DOM overlay for column filtering.
 *
 * Positioned absolutely over the scroll container. Shows operator selector,
 * value input, and Apply/Clear buttons. Dismissed on Escape or outside click.
 * Follows the InlineEditor positioning pattern.
 */

import type { LayoutEngine } from '../renderer/layout-engine';
import type { ScrollManager } from '../renderer/scroll-manager';
import type { SpreadsheetTheme } from '../themes/theme-types';
import type { FilterOperator } from './filter-engine';

export interface FilterPanelConfig {
  container: HTMLElement;
  scrollContainer: HTMLElement;
  layoutEngine: LayoutEngine;
  scrollManager: ScrollManager;
  theme: SpreadsheetTheme;
  onApply: (col: number, operator: FilterOperator, value: string, valueTo?: string) => void;
  onClear: (col: number) => void;
}

/** Operators shown in the UI dropdown. */
const OPERATOR_OPTIONS: { value: FilterOperator; label: string }[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'notEquals', label: 'Not equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'startsWith', label: 'Starts with' },
  { value: 'endsWith', label: 'Ends with' },
  { value: 'greaterThan', label: 'Greater than' },
  { value: 'lessThan', label: 'Less than' },
  { value: 'greaterThanOrEqual', label: 'Greater or equal' },
  { value: 'lessThanOrEqual', label: 'Less or equal' },
  { value: 'between', label: 'Between' },
  { value: 'isEmpty', label: 'Is empty' },
  { value: 'isNotEmpty', label: 'Is not empty' },
];

export class FilterPanel {
  private config: FilterPanelConfig;
  private panel: HTMLDivElement | null = null;
  private _isOpen = false;
  private _currentCol = -1;
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;
  private escapeHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(config: FilterPanelConfig) {
    this.config = config;
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  get currentCol(): number {
    return this._currentCol;
  }

  /** Update theme for runtime theme switching. */
  setTheme(theme: SpreadsheetTheme): void {
    this.config = { ...this.config, theme };
  }

  /** Open the filter panel for a specific column. */
  open(col: number, currentOperator?: FilterOperator, currentValue?: string): void {
    if (this._isOpen) {
      this.close();
    }

    this._currentCol = col;
    this._isOpen = true;

    // Create panel DOM
    this.panel = document.createElement('div');
    this.panel.className = 'wit-filter-panel';
    this.applyStyles();
    this.buildContent(currentOperator, currentValue);
    this.positionPanel(col);

    this.config.container.appendChild(this.panel);

    // Dismiss handlers
    this.outsideClickHandler = (e: MouseEvent) => {
      if (this.panel && !this.panel.contains(e.target as Node)) {
        this.close();
      }
    };
    // Delay to avoid the opening click triggering close
    setTimeout(() => {
      document.addEventListener('mousedown', this.outsideClickHandler!);
    }, 0);

    this.escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close();
      }
    };
    document.addEventListener('keydown', this.escapeHandler);

    // Focus the value input
    const valueInput = this.panel.querySelector<HTMLInputElement>('.wit-filter-value');
    valueInput?.focus();
  }

  /** Close the filter panel. */
  close(): void {
    if (!this._isOpen) return;

    if (this.outsideClickHandler) {
      document.removeEventListener('mousedown', this.outsideClickHandler);
      this.outsideClickHandler = null;
    }
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler);
      this.escapeHandler = null;
    }

    if (this.panel && this.panel.parentElement) {
      this.panel.parentElement.removeChild(this.panel);
    }
    this.panel = null;
    this._isOpen = false;
    this._currentCol = -1;
  }

  /** Destroy the panel and remove event listeners. */
  destroy(): void {
    this.close();
  }

  private buildContent(currentOperator?: FilterOperator, currentValue?: string): void {
    if (!this.panel) return;

    // Operator select
    const select = document.createElement('select');
    select.className = 'wit-filter-operator';
    for (const opt of OPERATOR_OPTIONS) {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (currentOperator === opt.value) option.selected = true;
      select.appendChild(option);
    }

    // Value input
    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.className = 'wit-filter-value';
    valueInput.placeholder = 'Filter value...';
    if (currentValue != null) valueInput.value = currentValue;

    // Second value input (for between)
    const valueToInput = document.createElement('input');
    valueToInput.type = 'text';
    valueToInput.className = 'wit-filter-value-to';
    valueToInput.placeholder = 'To value...';
    valueToInput.style.display = 'none';

    // Toggle visibility based on operator
    const updateVisibility = () => {
      const op = select.value as FilterOperator;
      const needsValue = op !== 'isEmpty' && op !== 'isNotEmpty';
      const needsRange = op === 'between';
      valueInput.style.display = needsValue ? 'block' : 'none';
      valueToInput.style.display = needsRange ? 'block' : 'none';
    };
    select.addEventListener('change', updateVisibility);

    // If current operator set, update visibility
    if (currentOperator) {
      select.value = currentOperator;
    }
    updateVisibility();

    // Buttons
    const btnContainer = document.createElement('div');
    btnContainer.className = 'wit-filter-buttons';

    const applyBtn = document.createElement('button');
    applyBtn.className = 'wit-filter-apply';
    applyBtn.textContent = 'Apply';
    applyBtn.addEventListener('click', () => {
      const op = select.value as FilterOperator;
      const val = valueInput.value;
      const valTo = valueToInput.value || undefined;
      this.config.onApply(this._currentCol, op, val, valTo);
      this.close();
    });

    const clearBtn = document.createElement('button');
    clearBtn.className = 'wit-filter-clear';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', () => {
      this.config.onClear(this._currentCol);
      this.close();
    });

    btnContainer.appendChild(applyBtn);
    btnContainer.appendChild(clearBtn);

    // Enter key applies filter
    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        applyBtn.click();
      }
    };
    valueInput.addEventListener('keydown', handleEnter);
    valueToInput.addEventListener('keydown', handleEnter);

    // Stop event propagation to prevent grid keyboard handling, but allow Escape to close
    this.panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
      e.stopPropagation();
    });
    this.panel.addEventListener('mousedown', (e) => e.stopPropagation());

    this.panel.appendChild(select);
    this.panel.appendChild(valueInput);
    this.panel.appendChild(valueToInput);
    this.panel.appendChild(btnContainer);
  }

  private positionPanel(col: number): void {
    if (!this.panel) return;

    const layout = this.config.layoutEngine;
    const scroll = this.config.scrollManager;

    // Compute column header position
    let colX = layout.rowNumberWidth;
    for (let i = 0; i < col; i++) {
      colX += layout.getColumnWidth(i);
    }
    const colWidth = layout.getColumnWidth(col);
    const headerHeight = layout.headerHeight;

    // Viewport-relative position (subtract scroll offset)
    const left = colX - scroll.scrollX;
    const top = headerHeight;

    // Panel width: at least column width, min 200px
    const panelWidth = Math.max(colWidth, 200);

    this.panel.style.left = `${left}px`;
    this.panel.style.top = `${top}px`;
    this.panel.style.width = `${panelWidth}px`;
  }

  private applyStyles(): void {
    if (!this.panel) return;
    const theme = this.config.theme;

    Object.assign(this.panel.style, {
      position: 'absolute',
      zIndex: '30',
      margin: '0',
      background: theme.colors.background,
      border: `1px solid ${theme.colors.headerBorder}`,
      borderRadius: '4px',
      padding: '8px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      fontFamily: theme.fonts.header,
      fontSize: `${theme.fonts.cellSize}px`,
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    });

    // Add scoped styles for child elements
    const style = document.createElement('style');
    style.textContent = `
      .wit-filter-panel select,
      .wit-filter-panel input {
        width: 100%;
        padding: 4px 6px;
        border: 1px solid ${theme.colors.headerBorder};
        border-radius: 6px;
        font-family: ${theme.fonts.header};
        font-size: ${theme.fonts.cellSize}px;
        background: ${theme.colors.background};
        color: ${theme.colors.cellText};
        box-sizing: border-box;
        outline: none;
      }
      .wit-filter-panel select:focus,
      .wit-filter-panel input:focus {
        border-color: ${theme.colors.activeCellBorder};
      }
      .wit-filter-buttons {
        display: flex;
        gap: 6px;
      }
      .wit-filter-buttons button {
        flex: 1;
        padding: 6px 14px;
        border: 1px solid ${theme.colors.headerBorder};
        border-radius: 6px;
        cursor: pointer;
        font-family: ${theme.fonts.header};
        font-size: ${theme.fonts.cellSize}px;
        font-weight: 500;
        text-align: center;
        background: ${theme.colors.headerBackground};
        color: ${theme.colors.headerText};
        transition: background 0.15s, border-color 0.15s;
      }
      .wit-filter-buttons button:hover {
        background: ${theme.colors.gridLine};
      }
      .wit-filter-apply {
        background: ${theme.colors.activeCellBorder} !important;
        color: ${theme.colors.background} !important;
        border-color: ${theme.colors.activeCellBorder} !important;
        font-weight: 600 !important;
      }
      .wit-filter-apply:hover {
        filter: brightness(1.1) !important;
      }
    `;
    this.panel.appendChild(style);
  }
}
