import { describe, expect, it } from 'vitest';

import { serverEnvOf } from './server-env.util.ts';

describe('FEATURE: server env', (): void => {
  describe('GIVEN a captured env and no entry env', (): void => {
    it('WHEN the server env is built THEN Playwright defaults come first and the captured env overrides them', (): void => {
      const captured = { ['FORCE_COLOR']: '0', PATH: '/bin' };

      const env = serverEnvOf(captured, undefined);

      expect(env).toEqual({ BROWSER: 'none', ['DEBUG_COLORS']: '1', ['FORCE_COLOR']: '0', PATH: '/bin' });
    });
  });

  describe('GIVEN an entry env that repeats a captured key', (): void => {
    it('WHEN the server env is built THEN the entry env wins', (): void => {
      const captured = { PORT: '3000' };
      const entry = { PORT: '4173' };

      const env = serverEnvOf(captured, entry);

      expect(env['PORT']).toBe('4173');
    });
  });

  describe('GIVEN a captured env holding the listing-only variables', (): void => {
    it('WHEN the server env is built THEN they are dropped and TURBO_ATOMIZER stays', (): void => {
      const captured = {
        ['PLAYWRIGHT_JSON_OUTPUT_FILE']: '/tmp/report.json',
        ['TURBO_ATOMIZER']: '1',
        ['TURBO_ATOMIZER_DESCRIBE']: '1',
        ['TURBO_ATOMIZER_SERVER_ENV']: '1'
      };

      const env = serverEnvOf(captured, undefined);

      expect(env).toEqual({ BROWSER: 'none', ['DEBUG_COLORS']: '1', ['FORCE_COLOR']: '1', ['TURBO_ATOMIZER']: '1' });
    });
  });
});
