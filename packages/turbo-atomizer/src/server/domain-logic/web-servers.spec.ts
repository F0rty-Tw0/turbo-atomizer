import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startWebServers, stopWebServers } from './web-servers.ts';
import type { FixtureCopy } from '../../test/common/fixture-copy.type.ts';
import { copyFixture } from '../../test/utils/fixture-copy.spec.util.ts';
import type { StartOutcome } from '../common/server.type.ts';
import { freePort } from '../test/utils/static-server.spec.util.ts';

const START_TIMEOUT_MS = 30_000;

const startsOf = async (packageDir: string): Promise<string> => {
  return readFile(join(packageDir, '.atomizer/starts.log'), 'utf8').catch((): string => '');
};

describe('FEATURE: web servers', (): void => {
  let copy: FixtureCopy;
  let outcome: StartOutcome | undefined;

  beforeEach(async (): Promise<void> => {
    copy = await copyFixture('server-config');
    await mkdir(join(copy.directory, '.atomizer'));
    outcome = undefined;

    const port = await freePort();
    const secondPort = await freePort();

    vi.stubEnv('ATOMIZER_FIXTURE_PORT', String(port));
    vi.stubEnv('ATOMIZER_FIXTURE_PORT2', String(secondPort));
  });

  afterEach(async (): Promise<void> => {
    vi.unstubAllEnvs();

    if (outcome !== undefined) await stopWebServers(outcome.servers);

    await copy.dispose();
  });

  describe('GIVEN a webServer with neither url nor port', (): void => {
    it('WHEN the servers start THEN they fail before anything is spawned', async (): Promise<void> => {
      vi.stubEnv('ATOMIZER_FIXTURE_SERVER', 'no-url');

      outcome = await startWebServers(copy.directory, 'playwright.config.ts', new PassThrough());

      expect(outcome.ok).toBe(false);
      expect(outcome).toHaveProperty('message', expect.stringContaining('neither url nor port'));
      expect(outcome.servers).toEqual([]);
      await expect(startsOf(copy.directory)).resolves.toBe('');
    }, START_TIMEOUT_MS);
  });

  describe('GIVEN an array of two webServers, the second with a wait pattern', (): void => {
    it('WHEN the servers start THEN both run and the captured group is in env', async (): Promise<void> => {
      vi.stubEnv('ATOMIZER_FIXTURE_SERVER', 'array');

      outcome = await startWebServers(copy.directory, 'playwright.config.ts', new PassThrough());

      const starts = await startsOf(copy.directory);
      const expectedEnv = { ['SECOND_PORT']: process.env['ATOMIZER_FIXTURE_PORT2'] };

      expect(outcome.ok).toBe(true);
      expect(outcome).toHaveProperty('env', expectedEnv);
      expect(outcome.servers).toHaveLength(2);
      expect(starts.trim().split('\n')).toHaveLength(2);
    }, START_TIMEOUT_MS);
  });

  describe('GIVEN a Playwright config that cannot be listed', (): void => {
    it('WHEN the servers start THEN they fail with the listing error', async (): Promise<void> => {
      outcome = await startWebServers(copy.directory, 'missing.config.ts', new PassThrough());

      expect(outcome.ok).toBe(false);
      expect(outcome).toHaveProperty('message', expect.stringContaining('playwright test --list failed'));
    }, START_TIMEOUT_MS);
  });
});
