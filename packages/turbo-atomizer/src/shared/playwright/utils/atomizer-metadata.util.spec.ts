import type { PlaywrightTestConfig, PlaywrightTestProject } from '@playwright/test';
import { describe, expect, it } from 'vitest';

import { describeConfig } from './atomizer-metadata.util.ts';
import type { WebServerFact } from '../../atomizer/common/atomizer.type.ts';
import type { PlaywrightWebServer } from '../common/playwright.type.ts';
import { PLAYWRIGHT_WEB_SERVER_STUB } from '../test/stubs/playwright.stub.ts';

describe('FEATURE: atomizer metadata', (): void => {
  describe('GIVEN an empty config', (): void => {
    it('WHEN it is described THEN the metadata carries version 1 and empty facts', (): void => {
      const metadata = describeConfig({}, false);

      expect(metadata).toStrictEqual({
        reporters: [['list', {}]],
        setupProjects: [],
        snapshotDirs: [null],
        snapshotPathTemplates: [null],
        version: 1,
        webServers: []
      });
    });

    it('WHEN it is described with ciDefault THEN the default reporter is dot', (): void => {
      const metadata = describeConfig({}, true);

      expect(metadata.reporters).toEqual([['dot', {}]]);
    });

    it('WHEN it is described with a server env THEN serverEnv is recorded', (): void => {
      const serverEnv = { PORT: '3000' };

      const metadata = describeConfig({}, false, serverEnv);

      expect(metadata.serverEnv).toEqual({ PORT: '3000' });
    });
  });

  describe('GIVEN reporters configured', (): void => {
    it('WHEN the reporter is a string THEN it becomes one pair with empty options', (): void => {
      const metadata = describeConfig({ reporter: 'html' }, false);

      expect(metadata.reporters).toEqual([['html', {}]]);
    });

    it('WHEN the reporters are tuples THEN options are kept and missing options become empty', (): void => {
      const blobOptions = { outputDir: 'blobs' };
      const config: PlaywrightTestConfig = { reporter: [['blob', blobOptions], ['line']] };

      const metadata = describeConfig(config, true);

      expect(metadata.reporters).toEqual([
        ['blob', { outputDir: 'blobs' }],
        ['line', {}]
      ]);
    });
  });

  describe('GIVEN web servers configured', (): void => {
    it('WHEN a single server is described THEN one fact is recorded', (): void => {
      const metadata = describeConfig({ webServer: PLAYWRIGHT_WEB_SERVER_STUB }, false);

      expect(metadata.webServers).toEqual([{ command: 'pnpm start', url: 'http://localhost:3000' }]);
    });

    it('WHEN an array of servers is described THEN one fact per server is recorded', (): void => {
      const api: PlaywrightWebServer = { ...PLAYWRIGHT_WEB_SERVER_STUB, command: 'pnpm api' };
      const webServer = [PLAYWRIGHT_WEB_SERVER_STUB, api];

      const metadata = describeConfig({ webServer }, false);

      expect(metadata.webServers).toHaveLength(2);
    });

    it('WHEN a server sets every fact field THEN each is recorded raw', (): void => {
      const env = { MODE: 'test' };
      const gracefulShutdown: PlaywrightWebServer['gracefulShutdown'] = { signal: 'SIGTERM', timeout: 500 };
      const server: PlaywrightWebServer = {
        command: 'pnpm start',
        cwd: '../web',
        env,
        gracefulShutdown,
        ignoreHTTPSErrors: true,
        name: 'web',
        port: 3000,
        reuseExistingServer: false,
        stdout: 'pipe',
        timeout: 60000
      };
      const expected: WebServerFact = {
        command: 'pnpm start',
        cwd: '../web',
        env,
        gracefulShutdown,
        ignoreHTTPSErrors: true,
        port: 3000,
        timeout: 60000
      };

      const metadata = describeConfig({ webServer: server }, false);

      expect(metadata.webServers).toEqual([expected]);
    });

    it('WHEN a server waits on stdout and stderr patterns THEN each is recorded as source and flags', (): void => {
      const wait = { stderr: /listening/, stdout: /ready on (?<PORT>\d+)/i };
      const server: PlaywrightWebServer = { ...PLAYWRIGHT_WEB_SERVER_STUB, wait };

      const stderr = { flags: '', source: 'listening' };
      const stdout = { flags: 'i', source: 'ready on (?<PORT>\\d+)' };

      const metadata = describeConfig({ webServer: server }, false);

      expect(metadata.webServers[0]?.wait).toEqual({ stderr, stdout });
    });

    it('WHEN a server waits on stdout only THEN only stdout is recorded', (): void => {
      const wait = { stdout: /ready/ };
      const server: PlaywrightWebServer = { ...PLAYWRIGHT_WEB_SERVER_STUB, wait };

      const stdout = { flags: '', source: 'ready' };

      const metadata = describeConfig({ webServer: server }, false);

      expect(metadata.webServers[0]?.wait).toEqual({ stdout });
    });
  });

  describe('GIVEN projects with dependencies and teardown', (): void => {
    const setup: PlaywrightTestProject = { name: 'setup', teardown: 'cleanup' };
    const cleanup: PlaywrightTestProject = { name: 'cleanup' };
    const chromium: PlaywrightTestProject = { dependencies: ['setup'], name: 'chromium' };
    const firefox: PlaywrightTestProject = { dependencies: ['setup'], name: 'firefox' };

    it('WHEN described THEN setupProjects holds each referenced project once', (): void => {
      const projects = [setup, cleanup, chromium, firefox];

      const metadata = describeConfig({ projects }, false);

      expect(metadata.setupProjects).toEqual(['cleanup', 'setup']);
    });

    it('WHEN only chromium depends on setup THEN setupProjects is setup', (): void => {
      const plainSetup: PlaywrightTestProject = { name: 'setup' };
      const projects = [plainSetup, chromium];

      const metadata = describeConfig({ projects }, false);

      expect(metadata.setupProjects).toEqual(['setup']);
    });
  });

  describe('GIVEN snapshot locations', (): void => {
    it('WHEN snapshotDir is set at top level THEN it is recorded', (): void => {
      const metadata = describeConfig({ snapshotDir: 'snaps' }, false);

      expect(metadata.snapshotDirs).toEqual(['snaps']);
    });

    it('WHEN snapshotDir is set on one project THEN it is recorded after the top-level null', (): void => {
      const mobile: PlaywrightTestProject = { name: 'mobile', snapshotDir: 'mobile-snaps' };
      const desktop: PlaywrightTestProject = { name: 'desktop' };
      const projects = [mobile, desktop];

      const metadata = describeConfig({ projects }, false);

      expect(metadata.snapshotDirs).toEqual([null, 'mobile-snaps', null]);
    });

    it('WHEN snapshotPathTemplate is set at top level and on one project THEN both are recorded with null elsewhere', (): void => {
      const mobile: PlaywrightTestProject = { name: 'mobile', snapshotPathTemplate: '{testDir}/mobile/{arg}{ext}' };
      const desktop: PlaywrightTestProject = { name: 'desktop' };
      const projects = [mobile, desktop];
      const config: PlaywrightTestConfig = { projects, snapshotPathTemplate: '{testDir}/{arg}{ext}' };

      const metadata = describeConfig(config, false);

      expect(metadata.snapshotPathTemplates).toEqual(['{testDir}/{arg}{ext}', '{testDir}/mobile/{arg}{ext}', null]);
    });
  });
});
