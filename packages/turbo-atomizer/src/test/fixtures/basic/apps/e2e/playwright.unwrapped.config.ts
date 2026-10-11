import { defineConfig } from '@playwright/test';

const setup = { name: 'setup', testMatch: /.*\.setup\.ts/ };
const main = { name: 'main', dependencies: ['setup'] };

export default defineConfig({
  testDir: './tests',
  projects: [setup, main]
});
