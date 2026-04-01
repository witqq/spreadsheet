// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * SelectEditor — CellEditor for 'select' columns.
 *
 * Renders a dropdown list of options from ColumnDef.selectOptions.
 * Supports keyboard navigation (ArrowUp/Down), Enter to commit,
 * Escape to close, and type-ahead filtering. Extends BaseOverlayEditor
 * for shared overlay lifecycle.
 */

import type { CellValue, SelectOption } from '../types/interfaces';
import { BaseOverlayEditor } from './base-overlay-editor';

/** Maximum visible options before the list scrolls. */
const MAX_VISIBLE_OPTIONS = 8;
/** Height of each option row in pixels. */
const OPTION_ROW_HEIGHT = 28;
/** Height of the search input area in pixels. */
const SEARCH_INPUT_HEIGHT = 32;

export class SelectEditor extends BaseOverlayEditor {
  readonly id = 'select';

  private options: SelectOption[] = [];
  private filteredOptions: SelectOption[] = [];
  private highlightedIndex = -1;
  private searchInput: HTMLInputElement | null = null;
  private listContainer: HTMLDivElement | null = null;
  private filterText = '';

  protected get overlayWidth(): number {
    return 200;
  }

  protected get overlayHeight(): number {
    const visibleCount = Math.min(this.options.length, MAX_VISIBLE_OPTIONS);
    return SEARCH_INPUT_HEIGHT + visibleCount * OPTION_ROW_HEIGHT + 2;
  }

  protected getAriaLabel(): string {
    return this.locale?.select?.ariaLabel ?? 'Select option';
  }

  protected initializeFromValue(value: CellValue): void {
    this.options = this.column?.selectOptions ?? [];
    this.filteredOptions = [...this.options];
    this.filterText = '';

    // Pre-select the current value
    const strValue = value == null ? '' : String(value);
    this.highlightedIndex = this.filteredOptions.findIndex(
      (o) => o.value === strValue,
    );
    if (this.highlightedIndex < 0 && this.filteredOptions.length > 0) {
      this.highlightedIndex = 0;
    }
  }

  protected renderContent(): void {
    if (!this.overlay || !this.theme) return;

    const theme = this.theme;

    // Search input
    const searchWrap = document.createElement('div');
    searchWrap.style.padding = '4px';
    searchWrap.style.borderBottom = `1px solid ${theme.colors.gridLine}`;

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.placeholder = this.locale?.select?.searchPlaceholder ?? 'Search...';
    this.searchInput.value = this.filterText;
    this.searchInput.style.width = '100%';
    this.searchInput.style.boxSizing = 'border-box';
    this.searchInput.style.padding = '4px 8px';
    this.searchInput.style.border = `1px solid ${theme.colors.gridLine}`;
    this.searchInput.style.borderRadius = '3px';
    this.searchInput.style.fontSize = `${theme.fonts.cellSize}px`;
    this.searchInput.style.fontFamily = theme.fonts.cell;
    this.searchInput.style.color = theme.colors.cellText;
    this.searchInput.style.backgroundColor = theme.colors.cellEditBackground;
    this.searchInput.style.outline = 'none';

    this.searchInput.addEventListener('input', () => {
      this.filterText = this.searchInput?.value ?? '';
      this.applyFilter();
    });

    searchWrap.appendChild(this.searchInput);
    this.overlay.appendChild(searchWrap);

    // Options list
    this.listContainer = document.createElement('div');
    this.listContainer.setAttribute('role', 'listbox');
    const maxHeight = MAX_VISIBLE_OPTIONS * OPTION_ROW_HEIGHT;
    this.listContainer.style.maxHeight = `${maxHeight}px`;
    this.listContainer.style.overflowY = 'auto';

    this.renderOptionsList();
    this.overlay.appendChild(this.listContainer);

    // Focus search input after overlay is attached
    setTimeout(() => this.searchInput?.focus(), 0);
  }

  protected onKeyDown(e: KeyboardEvent): void {
    e.stopPropagation();

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        this.close('escape');
        break;
      case 'Enter':
        e.preventDefault();
        this.commitHighlighted();
        break;
      case 'Tab':
        e.preventDefault();
        this.commitHighlighted();
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.moveHighlight(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.moveHighlight(-1);
        break;
    }
  }

  protected onCloseCleanup(): void {
    this.searchInput = null;
    this.listContainer = null;
  }

  // ─── Private helpers ──────────────────────────────────────

  private applyFilter(): void {
    const query = this.filterText.toLowerCase();
    if (query === '') {
      this.filteredOptions = [...this.options];
    } else {
      this.filteredOptions = this.options.filter((o) => {
        const label = o.label ?? o.value;
        return label.toLowerCase().includes(query);
      });
    }
    this.highlightedIndex = this.filteredOptions.length > 0 ? 0 : -1;
    this.renderOptionsList();
  }

  private renderOptionsList(): void {
    if (!this.listContainer || !this.theme) return;

    this.listContainer.innerHTML = '';
    const theme = this.theme;
    const currentValue = this.originalValue == null ? '' : String(this.originalValue);

    if (this.filteredOptions.length === 0) {
      const empty = document.createElement('div');
      empty.style.padding = '8px';
      empty.style.textAlign = 'center';
      empty.style.color = theme.colors.headerText ?? theme.colors.cellText;
      empty.style.fontSize = `${theme.fonts.cellSize}px`;
      empty.textContent = this.locale?.select?.noResults ?? 'No results';
      this.listContainer.appendChild(empty);
      return;
    }

    for (let i = 0; i < this.filteredOptions.length; i++) {
      const opt = this.filteredOptions[i];
      const row = document.createElement('div');
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(i === this.highlightedIndex));
      row.dataset.index = String(i);

      row.style.padding = '4px 8px';
      row.style.cursor = 'pointer';
      row.style.height = `${OPTION_ROW_HEIGHT}px`;
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.boxSizing = 'border-box';

      if (i === this.highlightedIndex) {
        row.style.backgroundColor = theme.colors.selectionFill;
      }

      if (opt.value === currentValue) {
        row.style.fontWeight = 'bold';
      }

      const label = document.createElement('span');
      label.textContent = opt.label ?? opt.value;
      label.style.overflow = 'hidden';
      label.style.textOverflow = 'ellipsis';
      label.style.whiteSpace = 'nowrap';
      row.appendChild(label);

      const idx = i;
      row.addEventListener('mouseenter', () => {
        this.highlightedIndex = idx;
        this.updateHighlight();
      });
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        this.highlightedIndex = idx;
        this.commitHighlighted();
      });

      this.listContainer.appendChild(row);
    }

    this.scrollHighlightedIntoView();
  }

  private moveHighlight(delta: number): void {
    if (this.filteredOptions.length === 0) return;
    this.highlightedIndex += delta;
    if (this.highlightedIndex < 0) {
      this.highlightedIndex = this.filteredOptions.length - 1;
    } else if (this.highlightedIndex >= this.filteredOptions.length) {
      this.highlightedIndex = 0;
    }
    this.updateHighlight();
    this.scrollHighlightedIntoView();
  }

  private updateHighlight(): void {
    if (!this.listContainer || !this.theme) return;
    const rows = this.listContainer.querySelectorAll('[role="option"]');
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as HTMLElement;
      row.setAttribute('aria-selected', String(i === this.highlightedIndex));
      row.style.backgroundColor = i === this.highlightedIndex
        ? this.theme.colors.selectionFill
        : '';
    }
  }

  private scrollHighlightedIntoView(): void {
    if (!this.listContainer || this.highlightedIndex < 0) return;
    const rows = this.listContainer.querySelectorAll('[role="option"]');
    if (this.highlightedIndex < rows.length) {
      const el = rows[this.highlightedIndex] as HTMLElement;
      el.scrollIntoView?.({ block: 'nearest' });
    }
  }

  private commitHighlighted(): void {
    if (this.highlightedIndex >= 0 && this.highlightedIndex < this.filteredOptions.length) {
      const selected = this.filteredOptions[this.highlightedIndex];
      this.commitFn?.(this._editingRow, this._editingCol, this.originalValue, selected.value);
    }
    this.close('enter');
  }
}
