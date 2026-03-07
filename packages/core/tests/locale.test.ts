// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import { describe, it, expect } from 'vitest';
import { resolveLocale } from '../src/locale/resolve-locale';
import { enLocale } from '../src/locale/en';
import { ruLocale } from '../src/locale/ru';
import type { SpreadsheetLocale } from '../src/locale/locale-types';

describe('Locale system', () => {
  describe('resolveLocale', () => {
    it('returns English defaults when no locale provided', () => {
      const resolved = resolveLocale();
      expect(resolved).toEqual(enLocale);
    });

    it('returns English defaults for undefined', () => {
      const resolved = resolveLocale(undefined);
      expect(resolved).toEqual(enLocale);
    });

    it('merges partial locale over English defaults', () => {
      const partial: SpreadsheetLocale = {
        contextMenu: { cut: 'Schneiden' },
      };
      const resolved = resolveLocale(partial);
      expect(resolved.contextMenu.cut).toBe('Schneiden');
      expect(resolved.contextMenu.copy).toBe('Copy'); // English fallback
      expect(resolved.formatLocale).toBe('en-US'); // English fallback
    });

    it('overrides formatLocale', () => {
      const resolved = resolveLocale({ formatLocale: 'de-DE' });
      expect(resolved.formatLocale).toBe('de-DE');
    });

    it('merges all categories independently', () => {
      const partial: SpreadsheetLocale = {
        datePicker: { today: 'Heute' },
        filter: { apply: 'Anwenden' },
        grouping: { sum: 'Summe' },
        emptyState: { noData: 'Keine Daten' },
        print: { showingRows: 'Zeige {shown} von {total} Zeilen' },
        aria: { sortCleared: 'Sortierung gelöscht' },
      };
      const resolved = resolveLocale(partial);
      expect(resolved.datePicker.today).toBe('Heute');
      expect(resolved.datePicker.ariaLabel).toBe('Date picker'); // fallback
      expect(resolved.filter.apply).toBe('Anwenden');
      expect(resolved.filter.clear).toBe('Clear'); // fallback
      expect(resolved.grouping.sum).toBe('Summe');
      expect(resolved.emptyState.noData).toBe('Keine Daten');
      expect(resolved.print.showingRows).toContain('{shown}');
      expect(resolved.aria.sortCleared).toBe('Sortierung gelöscht');
    });

    it('resolves full Russian locale without errors', () => {
      const resolved = resolveLocale(ruLocale);
      expect(resolved.formatLocale).toBe('ru-RU');
      expect(resolved.contextMenu.cut).toBe('Вырезать');
      expect(resolved.datePicker.today).toBe('Сегодня');
      expect(resolved.filter.apply).toBe('Применить');
      expect(resolved.grouping.sum).toBe('Сумма');
      expect(resolved.emptyState.noData).toBe('Нет данных');
      expect(resolved.print.showingRows).toContain('{shown}');
      expect(resolved.aria.sortCleared).toBe('Сортировка сброшена');
    });
  });

  describe('enLocale completeness', () => {
    it('has all required categories', () => {
      expect(enLocale.formatLocale).toBeDefined();
      expect(enLocale.contextMenu).toBeDefined();
      expect(enLocale.datePicker).toBeDefined();
      expect(enLocale.filter).toBeDefined();
      expect(enLocale.grouping).toBeDefined();
      expect(enLocale.emptyState).toBeDefined();
      expect(enLocale.print).toBeDefined();
      expect(enLocale.aria).toBeDefined();
    });

    it('has all 8 context menu items', () => {
      const cm = enLocale.contextMenu;
      expect(cm.cut).toBeTruthy();
      expect(cm.copy).toBeTruthy();
      expect(cm.paste).toBeTruthy();
      expect(cm.sortAscending).toBeTruthy();
      expect(cm.sortDescending).toBeTruthy();
      expect(cm.insertRowAbove).toBeTruthy();
      expect(cm.insertRowBelow).toBeTruthy();
      expect(cm.deleteRow).toBeTruthy();
    });

    it('has 12 month names and 7 week labels', () => {
      expect(enLocale.datePicker.monthNames).toHaveLength(12);
      expect(enLocale.datePicker.weekLabels).toHaveLength(7);
    });

    it('has template placeholders in print and aria strings', () => {
      expect(enLocale.print.showingRows).toContain('{shown}');
      expect(enLocale.print.showingRows).toContain('{total}');
      expect(enLocale.aria.sortedBy).toContain('{columns}');
      expect(enLocale.aria.filterActive).toContain('{visible}');
      expect(enLocale.aria.filterActive).toContain('{total}');
      expect(enLocale.aria.cellAnnouncement).toContain('{column}');
    });
  });

  describe('ruLocale completeness', () => {
    it('has same keys as enLocale', () => {
      const enKeys = Object.keys(enLocale).sort();
      const ruKeys = Object.keys(ruLocale).sort();
      expect(ruKeys).toEqual(enKeys);
    });

    it('has same number of context menu items', () => {
      expect(Object.keys(ruLocale.contextMenu)).toHaveLength(
        Object.keys(enLocale.contextMenu).length,
      );
    });

    it('has same number of filter items', () => {
      expect(Object.keys(ruLocale.filter)).toHaveLength(Object.keys(enLocale.filter).length);
    });
  });
});
