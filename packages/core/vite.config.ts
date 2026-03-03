import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({ rollupTypes: true }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'Spreadsheet',
      formats: ['es', 'cjs'],
      fileName: 'index',
    },
    sourcemap: true,
    minify: false,
  },
});
