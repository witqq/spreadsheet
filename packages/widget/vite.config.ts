import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      rollupTypes: true,
      tsconfigPath: resolve(import.meta.dirname, 'tsconfig.json'),
    }),
  ],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'Spreadsheet',
      formats: ['es', 'umd'],
      fileName: 'witqq-spreadsheet-widget',
    },
    // Bundle everything — no externals for widget mode
    rollupOptions: {
      output: {
        // Ensure IIFE/UMD exposes Spreadsheet global
        exports: 'named',
      },
    },
    minify: 'esbuild',
    sourcemap: true,
  },
});
