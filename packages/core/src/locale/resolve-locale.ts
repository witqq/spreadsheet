// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * Resolves a partial locale into a complete locale by merging with English defaults.
 */

import type { SpreadsheetLocale } from './locale-types';
import { enLocale } from './en';

export type ResolvedLocale = Required<SpreadsheetLocale>;

/** Deep-merge a partial locale over the English defaults. */
export function resolveLocale(locale?: SpreadsheetLocale): ResolvedLocale {
  if (!locale) return enLocale;

  return {
    formatLocale: locale.formatLocale ?? enLocale.formatLocale,
    contextMenu: { ...enLocale.contextMenu, ...locale.contextMenu },
    datePicker: { ...enLocale.datePicker, ...locale.datePicker },
    dateTimePicker: { ...enLocale.dateTimePicker, ...locale.dateTimePicker },
    select: { ...enLocale.select, ...locale.select },
    filter: { ...enLocale.filter, ...locale.filter },
    grouping: { ...enLocale.grouping, ...locale.grouping },
    emptyState: { ...enLocale.emptyState, ...locale.emptyState },
    print: { ...enLocale.print, ...locale.print },
    aria: { ...enLocale.aria, ...locale.aria },
  };
}
