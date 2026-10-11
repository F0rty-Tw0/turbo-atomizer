import { defineConfig } from 'vitest/config';

// Named vitest.e2e.config.ts so neither @nx/vitest (no inferred `test` target) nor the root vitest `projects` glob picks it up.
export default defineConfig({
  test: {
    name: 'turbo-atomizer-e2e',
    root: import.meta.dirname,
    watch: false,
    include: ['src/**/*.spec.ts'],
    exclude: ['**/fixtures/**', '**/tmp/**', '**/node_modules/**'],
    fileParallelism: false,
    testTimeout: 300_000,
    hookTimeout: 300_000,
    passWithNoTests: false
  }
});
