import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node20',
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: true,
  dts: false,
  banner: { js: '#!/usr/bin/env node' },
  external: ['react', 'ink', 'ink-spinner', 'ink-text-input', 'ink-select-input'],
});
