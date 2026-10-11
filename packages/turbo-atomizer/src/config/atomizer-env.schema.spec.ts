import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAtomizerEnv } from './atomizer-env.schema.ts';

describe('FEATURE: atomizer env reader', (): void => {
  beforeEach((): void => {
    vi.stubEnv('TURBO_ATOMIZER', undefined);
    vi.stubEnv('TURBO_ATOMIZER_DESCRIBE', undefined);
    vi.stubEnv('TURBO_ATOMIZER_SERVER_ENV', undefined);
    vi.stubEnv('TURBO_ATOMIZER_COUNT_FILE', undefined);
    vi.stubEnv('TURBO_ATOMIZER_ARGS', undefined);
  });

  afterEach((): void => {
    vi.unstubAllEnvs();
  });

  describe('GIVEN no TURBO_ATOMIZER* variables', (): void => {
    it('WHEN the env is read THEN every flag is off and countFile and args are undefined', (): void => {
      const env = getAtomizerEnv();

      expect(env).toEqual({ active: false, args: undefined, captureServerEnv: false, countFile: undefined, describe: false });
    });
  });

  describe('GIVEN TURBO_ATOMIZER=1', (): void => {
    it('WHEN the env is read THEN active is true', (): void => {
      vi.stubEnv('TURBO_ATOMIZER', '1');

      const env = getAtomizerEnv();

      expect(env.active).toBe(true);
    });
  });

  describe('GIVEN TURBO_ATOMIZER=0', (): void => {
    it('WHEN the env is read THEN active is false', (): void => {
      vi.stubEnv('TURBO_ATOMIZER', '0');

      const env = getAtomizerEnv();

      expect(env.active).toBe(false);
    });
  });

  describe('GIVEN TURBO_ATOMIZER_DESCRIBE=1 and TURBO_ATOMIZER_SERVER_ENV=1', (): void => {
    beforeEach((): void => {
      vi.stubEnv('TURBO_ATOMIZER_DESCRIBE', '1');
      vi.stubEnv('TURBO_ATOMIZER_SERVER_ENV', '1');
    });

    it('WHEN the env is read THEN describe is true', (): void => {
      const env = getAtomizerEnv();

      expect(env.describe).toBe(true);
    });

    it('WHEN the env is read THEN captureServerEnv is true', (): void => {
      const env = getAtomizerEnv();

      expect(env.captureServerEnv).toBe(true);
    });
  });

  describe('GIVEN TURBO_ATOMIZER_COUNT_FILE set to a path', (): void => {
    it('WHEN the env is read THEN countFile is that path', (): void => {
      vi.stubEnv('TURBO_ATOMIZER_COUNT_FILE', '/tmp/count.json');

      const env = getAtomizerEnv();

      expect(env.countFile).toBe('/tmp/count.json');
    });
  });

  describe('GIVEN TURBO_ATOMIZER_COUNT_FILE set to an empty string', (): void => {
    it('WHEN the env is read THEN it throws naming the variable', (): void => {
      vi.stubEnv('TURBO_ATOMIZER_COUNT_FILE', '');

      expect(getAtomizerEnv).toThrow(/TURBO_ATOMIZER_COUNT_FILE/);
    });
  });

  describe('GIVEN TURBO_ATOMIZER_ARGS set', (): void => {
    it('WHEN the env is read THEN args is the raw value', (): void => {
      vi.stubEnv('TURBO_ATOMIZER_ARGS', ' --grep @smoke ');

      const env = getAtomizerEnv();

      expect(env.args).toBe(' --grep @smoke ');
    });
  });
});
