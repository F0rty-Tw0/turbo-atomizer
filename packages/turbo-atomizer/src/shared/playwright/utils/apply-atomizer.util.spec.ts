import type { PlaywrightTestConfig } from '@playwright/test';
import { describe, expect, it } from 'vitest';

import { applyAtomizer } from './apply-atomizer.util.ts';
import type { AtomizerEnv } from '../../atomizer/common/atomizer.type.ts';
import type { PlaywrightWebServer } from '../common/playwright.type.ts';
import { ATOMIZER_ENV_STUB, PLAYWRIGHT_WEB_SERVER_STUB } from '../test/stubs/playwright.stub.ts';

const api: PlaywrightWebServer = { ...PLAYWRIGHT_WEB_SERVER_STUB, command: 'pnpm api' };
const emptyConfig: PlaywrightTestConfig = {};
const processEnv = { PORT: '3000' };

describe('FEATURE: apply atomizer', (): void => {
  describe('GIVEN TURBO_ATOMIZER unset', (): void => {
    it('WHEN applied THEN the input config is returned as is', (): void => {
      const config: PlaywrightTestConfig = { webServer: PLAYWRIGHT_WEB_SERVER_STUB };

      const applied = applyAtomizer(config, ATOMIZER_ENV_STUB, false, processEnv);

      expect(applied).toBe(config);
    });
  });

  describe('GIVEN TURBO_ATOMIZER=1', (): void => {
    const env: AtomizerEnv = { ...ATOMIZER_ENV_STUB, active: true };

    it('WHEN a single server is configured THEN it reuses the existing server', (): void => {
      const config: PlaywrightTestConfig = { webServer: PLAYWRIGHT_WEB_SERVER_STUB };

      const applied = applyAtomizer(config, env, false, processEnv);

      expect(applied.webServer).toEqual({ ...PLAYWRIGHT_WEB_SERVER_STUB, reuseExistingServer: true });
    });

    it('WHEN an array of servers is configured THEN every server reuses the existing server', (): void => {
      const webServer = [PLAYWRIGHT_WEB_SERVER_STUB, api];
      const reusedWeb = { ...PLAYWRIGHT_WEB_SERVER_STUB, reuseExistingServer: true };
      const reusedApi = { ...api, reuseExistingServer: true };

      const applied = applyAtomizer({ webServer }, env, false, processEnv);

      expect(applied.webServer).toEqual([reusedWeb, reusedApi]);
    });

    it('WHEN servers are configured THEN the input config is not mutated', (): void => {
      const config: PlaywrightTestConfig = { webServer: [PLAYWRIGHT_WEB_SERVER_STUB] };

      applyAtomizer(config, env, false, processEnv);

      expect(config).toEqual({ webServer: [PLAYWRIGHT_WEB_SERVER_STUB] });
    });

    it('WHEN metadata is configured THEN it is unchanged', (): void => {
      const metadata = { team: 'web' };
      const config: PlaywrightTestConfig = { metadata, webServer: PLAYWRIGHT_WEB_SERVER_STUB };

      const applied = applyAtomizer(config, env, false, processEnv);

      expect(applied.metadata).toBe(metadata);
    });

    it('WHEN no server is configured THEN no webServer key is added', (): void => {
      const applied = applyAtomizer({ testDir: './tests' }, env, false, processEnv);

      expect(applied).toStrictEqual({ testDir: './tests' });
    });
  });

  describe('GIVEN TURBO_ATOMIZER=1 and TURBO_ATOMIZER_DESCRIBE=1', (): void => {
    const env: AtomizerEnv = { ...ATOMIZER_ENV_STUB, active: true, describe: true };

    it('WHEN an array of two servers is configured THEN the metadata lists two web servers', (): void => {
      const webServer = [PLAYWRIGHT_WEB_SERVER_STUB, api];
      const webFact = { command: 'pnpm start', url: 'http://localhost:3000' };
      const apiFact = { command: 'pnpm api', url: 'http://localhost:3000' };
      const config: PlaywrightTestConfig = { webServer };

      const applied = applyAtomizer(config, env, false, processEnv);

      expect(applied.metadata?.['turbo-atomizer']).toHaveProperty('webServers', [webFact, apiFact]);
    });

    it('WHEN metadata is configured THEN its keys are kept beside the atomizer key', (): void => {
      const metadata = { team: 'web' };
      const config: PlaywrightTestConfig = { metadata };

      const applied = applyAtomizer(config, env, false, processEnv);

      expect(applied.metadata).toHaveProperty('team', 'web');
    });

    it('WHEN applied THEN the metadata omits serverEnv', (): void => {
      const applied = applyAtomizer(emptyConfig, env, false, processEnv);

      expect(applied.metadata?.['turbo-atomizer']).not.toHaveProperty('serverEnv');
    });

    it('WHEN applied with ciDefault THEN the default reporter is dot', (): void => {
      const applied = applyAtomizer(emptyConfig, env, true, processEnv);

      expect(applied.metadata?.['turbo-atomizer']).toHaveProperty('reporters', [['dot', {}]]);
    });
  });

  describe('GIVEN TURBO_ATOMIZER=1, TURBO_ATOMIZER_DESCRIBE=1 and TURBO_ATOMIZER_SERVER_ENV=1', (): void => {
    it('WHEN applied THEN the metadata records the process env as serverEnv', (): void => {
      const env: AtomizerEnv = { ...ATOMIZER_ENV_STUB, active: true, captureServerEnv: true, describe: true };

      const applied = applyAtomizer(emptyConfig, env, false, processEnv);

      expect(applied.metadata?.['turbo-atomizer']).toHaveProperty('serverEnv', { PORT: '3000' });
    });
  });

  describe('GIVEN TURBO_ATOMIZER_SERVER_ENV=1 without TURBO_ATOMIZER_DESCRIBE', (): void => {
    it('WHEN applied THEN no atomizer metadata is added', (): void => {
      const env: AtomizerEnv = { ...ATOMIZER_ENV_STUB, active: true, captureServerEnv: true };

      const applied = applyAtomizer(emptyConfig, env, false, processEnv);

      expect(applied.metadata).toBeUndefined();
    });
  });
});
