import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { removeMergeConfig, writeMergeConfig } from './merge-config.store.ts';

describe('FEATURE: merge config store', (): void => {
  describe('GIVEN an empty config dir', (): void => {
    let configDir: string;

    beforeEach(async (): Promise<void> => {
      configDir = await mkdtemp(join(tmpdir(), 'atomizer-merge-config-'));
    });

    afterEach(async (): Promise<void> => {
      await rm(configDir, { force: true, recursive: true });
    });

    it('WHEN the config is written THEN its path is playwright.atomizer-merge.config.mjs in that dir', async (): Promise<void> => {
      const path = await writeMergeConfig(configDir, 'export default {};\n');

      expect(path).toBe(join(configDir, 'playwright.atomizer-merge.config.mjs'));
    });

    it('WHEN the config is written THEN the file holds the text', async (): Promise<void> => {
      const path = await writeMergeConfig(configDir, 'export default {};\n');

      const text = await readFile(path, 'utf8');

      expect(text).toBe('export default {};\n');
    });

    it('WHEN a written config is removed THEN the file is gone', async (): Promise<void> => {
      const path = await writeMergeConfig(configDir, 'export default {};\n');

      await removeMergeConfig(path);

      expect(existsSync(path)).toBe(false);
    });

    it('WHEN a config that does not exist is removed THEN it resolves', async (): Promise<void> => {
      const path = join(configDir, 'playwright.atomizer-merge.config.mjs');

      const removal = removeMergeConfig(path);

      await expect(removal).resolves.toBeUndefined();
    });
  });
});
