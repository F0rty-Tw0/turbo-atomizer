import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { runExec } from './exec.ts';
import { TURBO_ATOMIZER_COUNT_FILE_ENV, TURBO_ATOMIZER_ENV } from '../../shared/atomizer/common/atomizer.const.ts';
import {
  PLAYWRIGHT_BLOB_OUTPUT_FILE_ENV,
  PLAYWRIGHT_HTML_OPEN_ENV,
  PLAYWRIGHT_HTML_OUTPUT_DIR_ENV,
  PLAYWRIGHT_JSON_OUTPUT_FILE_ENV,
  PLAYWRIGHT_JUNIT_OUTPUT_FILE_ENV
} from '../../shared/playwright/common/playwright.const.ts';
import type { ServerLease } from '../../shared/server/common/server-lease.type.ts';
import { toAtomSlug } from '../../sync/utils/atom-slug.util.ts';
import type { FixtureCopy } from '../../test/common/fixture-copy.type.ts';
import { copyFixture } from '../../test/utils/fixture-copy.spec.util.ts';
import type { ExecDeps } from '../common/exec.type.ts';

const RUN_TIMEOUT_MS = 60_000;
const COUNT_REPORTER_PATH = join(import.meta.dirname, '../../count-reporter.ts');
const SILENT_REPORTER_PATH = join(import.meta.dirname, '../test/fixtures/silent-reporter.ts');
const A_ARGV = ['tests/a.spec.ts', 'a.spec.ts'];
const CONFIG_ARG = '--config=playwright.config.ts';

type ExecProbe = {
  readonly deps: ExecDeps;
  readonly calls: string[][];
};

const execProbe = (countReporterPath: string): ExecProbe => {
  const calls: string[][] = [];

  const release = (): void => {
    calls.push(['release']);
  };

  const ensureServer = async (packageDir: string, configFile: string): Promise<ServerLease> => {
    const lease: ServerLease = { env: {}, release };

    calls.push(['ensureServer', packageDir, configFile]);

    return Promise.resolve(lease);
  };

  const deps: ExecDeps = { ensureServer, countReporterPath };
  const probe: ExecProbe = { deps, calls };

  return probe;
};

describe('FEATURE: exec', (): void => {
  let copy: FixtureCopy;
  let packageDir: string;
  let stderrChunks: string[];
  let restoreStderr: () => void;

  const captureStderr = (chunk: string | Uint8Array): boolean => {
    stderrChunks.push(String(chunk));

    return true;
  };

  beforeAll(async (): Promise<void> => {
    copy = await copyFixture('basic');
    packageDir = join(copy.directory, 'apps/e2e');
  });

  afterAll(async (): Promise<void> => {
    await copy.dispose();
  });

  beforeEach((): void => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(captureStderr);

    stderrChunks = [];
    restoreStderr = (): void => {
      stderrSpy.mockRestore();
    };
  });

  afterEach((): void => {
    restoreStderr();
  });

  describe('GIVEN the test package, a spec task and a planted file in its slug dir', (): void => {
    const slugDir = (): string => join(packageDir, '.atomizer', toAtomSlug('tests/a.spec.ts'));
    let probe: ExecProbe;
    let exitCode: number;
    let envDump: unknown;

    beforeAll(async (): Promise<void> => {
      const envOut = join(copy.directory, 'env.json');

      await mkdir(slugDir(), { recursive: true });
      await writeFile(join(slugDir(), 'planted.txt'), 'stale');
      vi.stubEnv('ATOMIZER_FIXTURE_ENV_OUT', envOut);
      probe = execProbe(COUNT_REPORTER_PATH);
      exitCode = await runExec([...A_ARGV, '--atomizer-blob', CONFIG_ARG], packageDir, probe.deps);
      vi.unstubAllEnvs();
      envDump = JSON.parse(await readFile(envOut, 'utf8'));
    }, RUN_TIMEOUT_MS);

    it('WHEN exec runs THEN it exits 0', (): void => {
      expect(exitCode).toBe(0);
    });

    it('WHEN exec runs THEN the blob reporter wrote blob.zip', (): void => {
      expect(existsSync(join(slugDir(), 'blob.zip'))).toBe(true);
    });

    it('WHEN exec runs THEN count.json counts the spec test and its setup test', async (): Promise<void> => {
      const text = await readFile(join(slugDir(), 'count.json'), 'utf8');

      expect(text).toBe('{"selected":2}');
    });

    it('WHEN exec runs THEN the test env points every report at the slug dir', (): void => {
      const expected = {
        [TURBO_ATOMIZER_ENV]: '1',
        [PLAYWRIGHT_BLOB_OUTPUT_FILE_ENV]: join(slugDir(), 'blob.zip'),
        [PLAYWRIGHT_HTML_OUTPUT_DIR_ENV]: join(slugDir(), 'html'),
        [PLAYWRIGHT_HTML_OPEN_ENV]: 'never',
        [PLAYWRIGHT_JSON_OUTPUT_FILE_ENV]: join(slugDir(), 'report.json'),
        [PLAYWRIGHT_JUNIT_OUTPUT_FILE_ENV]: join(slugDir(), 'junit.xml'),
        [TURBO_ATOMIZER_COUNT_FILE_ENV]: join(slugDir(), 'count.json')
      };

      expect(envDump).toMatchObject(expected);
    });

    it('WHEN exec runs THEN the planted file is gone', (): void => {
      expect(existsSync(join(slugDir(), 'planted.txt'))).toBe(false);
    });

    it('WHEN exec runs THEN the server is ensured for the package and config, then released', (): void => {
      expect(probe.calls).toEqual([['ensureServer', packageDir, 'playwright.config.ts'], ['release']]);
    });
  });

  describe('GIVEN a stale list line', (): void => {
    const staleArgv = ['tests/a.spec.ts', 'stale.spec.ts', CONFIG_ARG];

    it(
      'WHEN exec runs without a filter THEN it exits 1 and says no tests were selected',
      async (): Promise<void> => {
        const probe = execProbe(COUNT_REPORTER_PATH);

        const exitCode = await runExec(staleArgv, packageDir, probe.deps);
        const stderr = stderrChunks.join('');

        expect(exitCode).toBe(1);
        expect(stderr).toContain('no tests selected for tests/a.spec.ts; run turbo-atomizer sync');
      },
      RUN_TIMEOUT_MS
    );

    it(
      'WHEN exec runs with a forwarded --grep THEN it exits 0',
      async (): Promise<void> => {
        const probe = execProbe(COUNT_REPORTER_PATH);

        const exitCode = await runExec([...staleArgv, '--grep', 'nothing'], packageDir, probe.deps);

        expect(exitCode).toBe(0);
      },
      RUN_TIMEOUT_MS
    );
  });

  describe('GIVEN a counting reporter that writes no count file', (): void => {
    it(
      'WHEN exec runs THEN it exits 1 and names the missing count file',
      async (): Promise<void> => {
        const probe = execProbe(SILENT_REPORTER_PATH);

        const exitCode = await runExec([...A_ARGV, CONFIG_ARG], packageDir, probe.deps);
        const stderr = stderrChunks.join('');

        expect(exitCode).toBe(1);
        expect(stderr).toContain('count.json');
      },
      RUN_TIMEOUT_MS
    );
  });

  describe('GIVEN a forwarded arg Playwright rejects', (): void => {
    it(
      'WHEN exec runs THEN it exits with the Playwright code and releases the server',
      async (): Promise<void> => {
        const probe = execProbe(COUNT_REPORTER_PATH);

        const exitCode = await runExec([...A_ARGV, CONFIG_ARG, '--workers=abc'], packageDir, probe.deps);
        const stderr = stderrChunks.join('');

        expect(exitCode).toBe(1);
        expect(stderr).not.toContain('no tests selected');
        expect(probe.calls.at(-1)).toEqual(['release']);
      },
      RUN_TIMEOUT_MS
    );
  });

  describe('GIVEN a task path that does not exist', (): void => {
    it('WHEN exec runs THEN it exits 1 and asks for sync', async (): Promise<void> => {
      const probe = execProbe(COUNT_REPORTER_PATH);

      const exitCode = await runExec(['tests/gone.spec.ts', 'gone.spec.ts', CONFIG_ARG], packageDir, probe.deps);
      const stderr = stderrChunks.join('');

      expect(exitCode).toBe(1);
      expect(stderr).toContain('run turbo-atomizer sync');
      expect(probe.calls).toEqual([]);
    });

    it('WHEN no --config arg is given THEN the default config is found and sync is asked for', async (): Promise<void> => {
      const probe = execProbe(COUNT_REPORTER_PATH);

      const exitCode = await runExec(['tests/gone.spec.ts', 'gone.spec.ts'], packageDir, probe.deps);
      const stderr = stderrChunks.join('');

      expect(exitCode).toBe(1);
      expect(stderr).toContain('run turbo-atomizer sync');
    });
  });

  describe('GIVEN a cwd without the Playwright config', (): void => {
    it('WHEN exec runs with --config THEN it exits 1 and asks to run from the test package', async (): Promise<void> => {
      const probe = execProbe(COUNT_REPORTER_PATH);

      const exitCode = await runExec([...A_ARGV, CONFIG_ARG], copy.directory, probe.deps);
      const stderr = stderrChunks.join('');

      expect(exitCode).toBe(1);
      expect(stderr).toContain('run from the test package');
    });

    it('WHEN exec runs without --config THEN it exits 1 and asks to run from the test package', async (): Promise<void> => {
      const probe = execProbe(COUNT_REPORTER_PATH);

      const exitCode = await runExec(A_ARGV, copy.directory, probe.deps);
      const stderr = stderrChunks.join('');

      expect(exitCode).toBe(1);
      expect(stderr).toContain('run from the test package');
    });
  });
});
