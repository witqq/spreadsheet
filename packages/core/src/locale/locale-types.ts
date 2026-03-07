// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * Locale type definitions for built-in UI string translations.
 *
 * All fields are optional — missing keys fall back to English defaults.
 */

export interface SpreadsheetLocale {
  /** BCP 47 locale tag used for number/date formatting (e.g. 'en-US', 'ru-RU'). */
  formatLocale?: string;

  // ─── Context menu ───
  contextMenu?: {
    cut?: string;
    copy?: string;
    paste?: string;
    sortAscending?: string;
    sortDescending?: string;
    insertRowAbove?: string;
    insertRowBelow?: string;
    deleteRow?: string;
  };

  // ─── Date picker ───
  datePicker?: {
    weekLabels?: [string, string, string, string, string, string, string];
    monthNames?: [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    today?: string;
    ariaLabel?: string;
  };

  // ─── Date-time picker ───
  dateTimePicker?: {
    hour?: string;
    minute?: string;
    now?: string;
    ariaLabel?: string;
  };

  // ─── Filter panel ───
  filter?: {
    equals?: string;
    notEquals?: string;
    contains?: string;
    startsWith?: string;
    endsWith?: string;
    greaterThan?: string;
    lessThan?: string;
    greaterOrEqual?: string;
    lessOrEqual?: string;
    between?: string;
    isEmpty?: string;
    isNotEmpty?: string;
    valuePlaceholder?: string;
    toValuePlaceholder?: string;
    apply?: string;
    clear?: string;
  };

  // ─── Grouping aggregates ───
  grouping?: {
    sum?: string;
    count?: string;
    avg?: string;
    min?: string;
    max?: string;
  };

  // ─── Empty state ───
  emptyState?: {
    noData?: string;
  };

  // ─── Print ───
  print?: {
    showingRows?: string; // e.g. "Showing {shown} of {total} rows"
  };

  // ─── ARIA ───
  aria?: {
    cellAnnouncement?: string; // e.g. "{column}, Row {row}: {value}"
    cellEmpty?: string;
    sortCleared?: string;
    sortAscending?: string;
    sortDescending?: string;
    sortedBy?: string; // e.g. "Sorted by {columns}"
    filterCleared?: string;
    filterActive?: string; // e.g. "Filtered: {visible} of {total} rows visible"
  };
}
