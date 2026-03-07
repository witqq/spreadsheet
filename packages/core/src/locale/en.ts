// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * English locale — the default locale for @witqq/spreadsheet.
 *
 * Every key has a value, making this the canonical fallback.
 */

import type { SpreadsheetLocale } from './locale-types';

export const enLocale: Required<SpreadsheetLocale> = {
  formatLocale: 'en-US',

  contextMenu: {
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    sortAscending: 'Sort Ascending',
    sortDescending: 'Sort Descending',
    insertRowAbove: 'Insert Row Above',
    insertRowBelow: 'Insert Row Below',
    deleteRow: 'Delete Row',
  },

  datePicker: {
    weekLabels: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
    monthNames: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
    today: 'Today',
    ariaLabel: 'Date picker',
  },

  dateTimePicker: {
    hour: 'Hour',
    minute: 'Minute',
    now: 'Now',
    ariaLabel: 'Date and time picker',
  },

  filter: {
    equals: 'Equals',
    notEquals: 'Not equals',
    contains: 'Contains',
    startsWith: 'Starts with',
    endsWith: 'Ends with',
    greaterThan: 'Greater than',
    lessThan: 'Less than',
    greaterOrEqual: 'Greater or equal',
    lessOrEqual: 'Less or equal',
    between: 'Between',
    isEmpty: 'Is empty',
    isNotEmpty: 'Is not empty',
    valuePlaceholder: 'Filter value...',
    toValuePlaceholder: 'To value...',
    apply: 'Apply',
    clear: 'Clear',
  },

  grouping: {
    sum: 'Sum',
    count: 'Count',
    avg: 'Avg',
    min: 'Min',
    max: 'Max',
  },

  emptyState: {
    noData: 'No data',
  },

  print: {
    showingRows: 'Showing {shown} of {total} rows',
  },

  aria: {
    cellAnnouncement: '{column}, Row {row}: {value}',
    cellEmpty: 'empty',
    sortCleared: 'Sort cleared',
    sortAscending: 'ascending',
    sortDescending: 'descending',
    sortedBy: 'Sorted by {columns}',
    filterCleared: 'Filter cleared, showing all rows',
    filterActive: 'Filtered: {visible} of {total} rows visible',
  },
};
