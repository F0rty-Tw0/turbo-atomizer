import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'tools',
    root: import.meta.dirname,
    watch: false,
    include: ['src/**/*.spec.ts'],
    exclude: ['**/fixtures/**', '**/tmp/**', '**/node_modules/**'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    passWithNoTests: false
  }
});
