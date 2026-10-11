import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { mergeReportsHandler } from './merge-reports.handler.ts';
import type { FixtureCopy } from '../../test/common/fixture-copy.type.ts';
import { copyFixture } from '../../test/utils/fixture-copy.spec.util.ts';
import { writeMergeFixture } from '../test/utils/merge-fixture.spec.util.ts';

const MERGE_TIMEOUT_MS = 120_000;

describe('FEATURE: merge-reports handler', (): void => {
  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('GIVEN no package WHEN the handler runs THEN it exits 0', async (): Promise<void> => {
    const exitCode = await mergeReportsHandler([]);

    expect(exitCode).toBe(0);
  });

  describe('GIVEN a configured package with no blob and a dir that is not a test package', (): void => {
    let copy: FixtureCopy;
    let packageDir: string;
    let brokenDir: string;

    beforeAll(async (): Promise<void> => {
      copy = await copyFixture('basic');
      packageDir = await writeMergeFixture(copy.directory, ['tests/a.spec.ts']);
      brokenDir = await mkdtemp(join(tmpdir(), 'atomizer-not-a-package-'));
    });

    afterAll(async (): Promise<void> => {
      await copy.dispose();
      await rm(brokenDir, { force: true, recursive: true });
    });

    it(
      'WHEN only the configured package is merged THEN it exits 0',
      async (): Promise<void> => {
        vi.spyOn(process.stderr, 'write').mockReturnValue(true);

        const exitCode = await mergeReportsHandler([packageDir]);

        expect(exitCode).toBe(0);
      },
      MERGE_TIMEOUT_MS
    );

    describe('WHEN the broken dir is merged before the configured package', (): void => {
      let exitCode: number;
      let stderr: string;

      beforeAll(async (): Promise<void> => {
        const spy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

        exitCode = await mergeReportsHandler([brokenDir, packageDir]);
        stderr = spy.mock.calls.map(([chunk]): string => String(chunk)).join('');
        spy.mockRestore();
      }, MERGE_TIMEOUT_MS);

      it('THEN it exits 1', (): void => {
        expect(exitCode).toBe(1);
      });

      it('THEN the error names the broken dir', (): void => {
        expect(stderr).toContain(brokenDir);
      });

      it('THEN the configured package is still merged', (): void => {
        expect(stderr).toContain('0 of 1');
      });
    });
  });
});
