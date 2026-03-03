// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * Complete theme definition controlling all visual aspects of the table.
 *
 * Use {@link lightTheme} or {@link darkTheme} as a starting point,
 * then override individual properties.
 */
export interface SpreadsheetTheme {
  /** Theme identifier. */
  name: string;
  /** Color palette for all UI elements. */
  colors: {
    gridLine: string;
    background: string;
    headerBackground: string;
    headerText: string;
    headerBorder: string;
    selectionFill: string;
    selectionBorder: string;
    activeCellBorder: string;
    fillHandle: string;
    cellText: string;
    cellBorder: string;
    cellEditBackground: string;
    alternateRowBackground: string;
    hoverRowBackground: string;
    frozenSeparator: string;
    scrollbarTrack: string;
    scrollbarThumb: string;
    scrollbarThumbHover: string;
    errorBackground: string;
    warningBackground: string;
    changedIndicator: string;
    savedIndicator: string;
    cellPlaceholder: string;
  };
  /** Font families and sizes. */
  fonts: {
    cell: string;
    header: string;
    cellSize: number;
    headerSize: number;
  };
  /** Layout dimensions in pixels. */
  dimensions: {
    rowHeight: number;
    headerHeight: number;
    minColumnWidth: number;
    scrollbarWidth: number;
    cellPadding: number;
    borderWidth: number;
    rowNumberWidth: number;
  };
  /** Border widths in pixels. */
  borders: {
    gridLineWidth: number;
    selectionWidth: number;
    activeCellWidth: number;
    frozenPaneWidth: number;
  };
}
