import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({ rollupTypes: true }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'SpreadsheetAngular',
      formats: ['es', 'cjs'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        '@angular/core',
        '@angular/common',
        '@witqq/spreadsheet',
        'rxjs',
      ],
    },
    sourcemap: true,
    minify: false,
  },
});
