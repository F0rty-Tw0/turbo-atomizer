import { defineConfig } from '@playwright/test';

import { withAtomizer } from '../../../../../playwright.ts';

export default withAtomizer(
  defineConfig({
    testDir: './tests',
    webServer: { command: 'npm run start --workspace web', url: 'http://localhost:3000' }
  })
);
