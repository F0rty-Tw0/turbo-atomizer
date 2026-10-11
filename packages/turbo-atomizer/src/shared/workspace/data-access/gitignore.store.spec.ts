import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ensureGitignoreLines } from './gitignore.store.ts';
import type { FixtureCopy } from '../../../test/common/fixture-copy.type.ts';
import { copyFixture } from '../../../test/utils/fixture-copy.spec.util.ts';

const ATOMIZER_LINES = ['.atomizer/', 'playwright.atomizer-merge.config.mjs'];

describe('FEATURE: gitignore store', (): void => {
  let copy: FixtureCopy;

  afterEach(async (): Promise<void> => {
    await copy.dispose();
  });

  describe('GIVEN a .gitignore without the atomizer lines', (): void => {
    beforeEach(async (): Promise<void> => {
      copy = await copyFixture('init-pnpm');
    });

    it('WHEN the lines are ensured THEN they are appended after the existing lines', async (): Promise<void> => {
      await ensureGitignoreLines(copy.directory, ATOMIZER_LINES);

      const text = await readFile(join(copy.directory, '.gitignore'), 'utf8');

      expect(text).toBe('node_modules\n.atomizer/\nplaywright.atomizer-merge.config.mjs\n');
    });

    it('WHEN the lines are ensured THEN a change is reported', async (): Promise<void> => {
      const changed = await ensureGitignoreLines(copy.directory, ATOMIZER_LINES);

      expect(changed).toBe(true);
    });

    it('WHEN the lines are ensured twice THEN the second call reports no change', async (): Promise<void> => {
      await ensureGitignoreLines(copy.directory, ATOMIZER_LINES);

      const changed = await ensureGitignoreLines(copy.directory, ATOMIZER_LINES);

      expect(changed).toBe(false);
    });
  });

  describe('GIVEN a .gitignore with one line present and no trailing newline', (): void => {
    beforeEach(async (): Promise<void> => {
      copy = await copyFixture('init-pnpm');

      await writeFile(join(copy.directory, '.gitignore'), 'dist\n  .atomizer/  ');
    });

    it('WHEN the lines are ensured THEN only the missing line is added on its own line', async (): Promise<void> => {
      await ensureGitignoreLines(copy.directory, ATOMIZER_LINES);

      const text = await readFile(join(copy.directory, '.gitignore'), 'utf8');

      expect(text).toBe('dist\n  .atomizer/  \nplaywright.atomizer-merge.config.mjs\n');
    });
  });

  describe('GIVEN a workspace without .gitignore', (): void => {
    beforeEach(async (): Promise<void> => {
      copy = await copyFixture('init-npm');
    });

    it('WHEN the lines are ensured THEN .gitignore is created with them', async (): Promise<void> => {
      await ensureGitignoreLines(copy.directory, ATOMIZER_LINES);

      const text = await readFile(join(copy.directory, '.gitignore'), 'utf8');

      expect(text).toBe('.atomizer/\nplaywright.atomizer-merge.config.mjs\n');
    });
  });
});
