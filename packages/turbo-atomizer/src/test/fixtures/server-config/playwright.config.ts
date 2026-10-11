import { defineConfig } from '@playwright/test';
import type { PlaywrightTestConfig } from '@playwright/test';

import { withAtomizer } from '../../../playwright.ts';

type WebServerConfig = NonNullable<PlaywrightTestConfig['webServer']>;

const port = process.env['ATOMIZER_FIXTURE_PORT'] ?? '0';
const secondPort = process.env['ATOMIZER_FIXTURE_PORT2'] ?? '0';
const kind = process.env['ATOMIZER_FIXTURE_SERVER'] ?? 'ok';
const url = `http://127.0.0.1:${port}/index.html`;
const startsLog = '.atomizer/starts.log';

const ok = { command: `node static-server.mjs --port ${port} --delay 300 --starts-log ${startsLog}`, url };
const exit1 = { command: `node -e "console.error('fixture server failed'); process.exit(1)"`, url };
const noUrl = { command: ok.command };
const secondWait = { stdout: /ready on (?<second_port>\d+)/ };
const second = {
  command: `node static-server.mjs --port ${secondPort} --starts-log ${startsLog}`,
  port: Number(secondPort),
  wait: secondWait
};

const servers: Record<string, WebServerConfig> = { ok, exit1, 'no-url': noUrl, array: [ok, second] };

export default withAtomizer(
  defineConfig({
    testDir: './tests',
    webServer: servers[kind]
  })
);
