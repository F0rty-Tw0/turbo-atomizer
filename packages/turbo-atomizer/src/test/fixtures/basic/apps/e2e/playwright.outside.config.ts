import { defineConfig } from '@playwright/test';

import { withAtomizer } from '../../../../../playwright.ts';

export default withAtomizer(
  defineConfig({
    testDir: '../outside'
  })
);
