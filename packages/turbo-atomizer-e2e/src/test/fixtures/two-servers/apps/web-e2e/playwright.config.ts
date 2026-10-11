import { defineConfig, devices } from '@playwright/test';
import { withAtomizer } from 'turbo-atomizer/playwright';

import { mainPort, mainURL, sidePort, sideURL } from './support/servers';

export default withAtomizer(
  defineConfig({
    testDir: './tests',
    reporter: 'list',
    use: { baseURL: mainURL },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: [
      { command: `node ../web/server.js ${mainPort} starts-1`, url: mainURL },
      { command: `node ../web/server.js ${sidePort} starts-2`, url: sideURL }
    ]
  })
);
