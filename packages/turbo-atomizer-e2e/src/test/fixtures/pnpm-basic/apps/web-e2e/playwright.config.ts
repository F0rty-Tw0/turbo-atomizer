import { defineConfig, devices } from '@playwright/test';
import { withAtomizer } from 'turbo-atomizer/playwright';

const port = Number('__ATOMIZER_E2E_PORT_1__');
const baseURL = `http://127.0.0.1:${port}`;

export default withAtomizer(
  defineConfig({
    testDir: './tests',
    reporter: 'list',
    use: { baseURL },
    projects: [
      { name: 'setup', testMatch: /.*\.setup\.ts/ },
      { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] }
    ],
    webServer: { command: `node ../web/server.js ${port}`, url: baseURL }
  })
);
