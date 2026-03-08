// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * Russian locale pack for @witqq/spreadsheet.
 */

import type { SpreadsheetLocale } from './locale-types';

export const ruLocale: Required<SpreadsheetLocale> = {
  formatLocale: 'ru-RU',

  contextMenu: {
    cut: 'Вырезать',
    copy: 'Копировать',
    paste: 'Вставить',
    sortAscending: 'Сортировка по возрастанию',
    sortDescending: 'Сортировка по убыванию',
    insertRowAbove: 'Вставить строку выше',
    insertRowBelow: 'Вставить строку ниже',
    deleteRow: 'Удалить строку',
  },

  datePicker: {
    weekLabels: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
    monthNames: [
      'Январь',
      'Февраль',
      'Март',
      'Апрель',
      'Май',
      'Июнь',
      'Июль',
      'Август',
      'Сентябрь',
      'Октябрь',
      'Ноябрь',
      'Декабрь',
    ],
    today: 'Сегодня',
    ariaLabel: 'Выбор даты',
  },

  dateTimePicker: {
    hour: 'Час',
    minute: 'Минута',
    now: 'Сейчас',
    ariaLabel: 'Выбор даты и времени',
  },

  filter: {
    equals: 'Равно',
    notEquals: 'Не равно',
    contains: 'Содержит',
    startsWith: 'Начинается с',
    endsWith: 'Заканчивается на',
    greaterThan: 'Больше',
    lessThan: 'Меньше',
    greaterOrEqual: 'Больше или равно',
    lessOrEqual: 'Меньше или равно',
    between: 'Между',
    isEmpty: 'Пусто',
    isNotEmpty: 'Не пусто',
    valuePlaceholder: 'Значение фильтра...',
    toValuePlaceholder: 'До значения...',
    apply: 'Применить',
    clear: 'Очистить',
  },

  grouping: {
    sum: 'Сумма',
    count: 'Кол-во',
    avg: 'Средн.',
    min: 'Мин',
    max: 'Макс',
  },

  emptyState: {
    noData: 'Нет данных',
  },

  print: {
    showingRows: 'Показано {shown} из {total} строк',
  },

  aria: {
    cellAnnouncement: '{column}, Строка {row}: {value}',
    cellEmpty: 'пусто',
    sortCleared: 'Сортировка сброшена',
    sortAscending: 'по возрастанию',
    sortDescending: 'по убыванию',
    sortedBy: 'Отсортировано по {columns}',
    filterCleared: 'Фильтр сброшен, показаны все строки',
    filterActive: 'Отфильтровано: {visible} из {total} строк видно',
  },
};
