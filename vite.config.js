import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    target: 'esnext',
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/models/**', 'src/importers/**', 'src/core/**'],
      thresholds: {
        lines: 80,
        functions: 85,
        branches: 75,
      },
    },
  },
});
