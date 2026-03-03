import { createApp, ref, h } from 'vue';
import { Spreadsheet } from '../src/index';
import { lightTheme, darkTheme } from '@witqq/spreadsheet';
import type { ColumnDef } from '@witqq/spreadsheet';

const columns: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 60, type: 'number' },
  { key: 'name', title: 'Name', width: 150 },
  { key: 'email', title: 'Email', width: 200 },
  { key: 'score', title: 'Score', width: 80, type: 'number' },
];

function generateData(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    score: Math.round(Math.random() * 100),
  }));
}

const App = {
  setup() {
    const dark = ref(false);
    const rowCount = ref(100);
    const data = ref(generateData(rowCount.value));
    const lastEvent = ref('(none)');

    const toggleTheme = () => { dark.value = !dark.value; };
    const addRows = () => {
      const start = data.value.length;
      const more = generateData(50).map((r, i) => ({ ...r, id: start + i + 1 }));
      data.value = [...data.value, ...more];
    };

    return () =>
      h('div', [
        h('div', { class: 'controls' }, [
          h('button', { onClick: toggleTheme }, dark.value ? '☀ Light' : '🌙 Dark'),
          h('button', { onClick: addRows }, '+ 50 rows'),
          h('span', `Rows: ${data.value.length} | Theme: ${dark.value ? 'dark' : 'light'} | Last event: ${lastEvent.value}`),
        ]),
        h('div', { class: 'table-container' }, [
          h(Spreadsheet, {
            columns,
            data: data.value,
            theme: dark.value ? darkTheme : lightTheme,
            onCellChange: (e: any) => { lastEvent.value = `cellChange(${e.row},${e.col})`; },
            onSelectionChange: (e: any) => { lastEvent.value = `selection(${e.activeCell?.row},${e.activeCell?.col})`; },
          }),
        ]),
      ]);
  },
};

createApp(App).mount('#app');
