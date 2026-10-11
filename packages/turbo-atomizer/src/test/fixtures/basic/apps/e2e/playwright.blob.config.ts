import { defineConfig } from '@playwright/test';

import { withAtomizer } from '../../../../../playwright.ts';

const setup = { name: 'setup', testMatch: /.*\.setup\.ts/ };
const main = { name: 'main', dependencies: ['setup'] };

export default withAtomizer(
  defineConfig({
    testDir: './tests',
    reporter: [['blob']],
    snapshotDir: './snapshots',
    projects: [setup, main]
  })
);
