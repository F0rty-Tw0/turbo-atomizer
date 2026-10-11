import { describe, expect, it } from 'vitest';

import { toPlaywrightTestArgs, toPlaywrightTestEnv } from './playwright-test-run.util.ts';
import { TURBO_ATOMIZER_COUNT_FILE_ENV, TURBO_ATOMIZER_ENV } from '../../shared/atomizer/common/atomizer.const.ts';
import {
  PLAYWRIGHT_BLOB_OUTPUT_FILE_ENV,
  PLAYWRIGHT_HTML_OPEN_ENV,
  PLAYWRIGHT_HTML_OUTPUT_DIR_ENV,
  PLAYWRIGHT_JSON_OUTPUT_FILE_ENV,
  PLAYWRIGHT_JUNIT_OUTPUT_FILE_ENV
} from '../../shared/playwright/common/playwright.const.ts';
import type { ExecArgs } from '../common/exec.type.ts';
import { EXEC_ARGS_STUB, SLUG_PATHS_STUB } from '../test/stubs/exec.stub.ts';

const REPORTER_PATH = '/dist/count-reporter.cjs';
const LIST_ARGS = ['--test-list', SLUG_PATHS_STUB.testList, '--output', SLUG_PATHS_STUB.testResults];

describe('FEATURE: Playwright test run', (): void => {
  describe('GIVEN exec args that need the blob reporter', (): void => {
    it('WHEN the args are built THEN blob and the counting reporter are added before the fixed args', (): void => {
      const execArgs: ExecArgs = { ...EXEC_ARGS_STUB, needsBlob: true };

      const args = toPlaywrightTestArgs(execArgs, SLUG_PATHS_STUB, REPORTER_PATH);

      expect(args).toEqual(['test', ...LIST_ARGS, `--add-reporter=blob,${REPORTER_PATH}`, '--config=playwright.config.ts']);
    });
  });

  describe('GIVEN exec args without the blob exec flag', (): void => {
    it('WHEN the args are built THEN only the counting reporter is added', (): void => {
      const args = toPlaywrightTestArgs(EXEC_ARGS_STUB, SLUG_PATHS_STUB, REPORTER_PATH);

      expect(args).toEqual(['test', ...LIST_ARGS, `--add-reporter=${REPORTER_PATH}`, '--config=playwright.config.ts']);
    });
  });

  describe('GIVEN forwarded reporters', (): void => {
    it('WHEN the args are built THEN they follow the counting reporter in the same list', (): void => {
      const execArgs: ExecArgs = { ...EXEC_ARGS_STUB, forwardedReporters: ['dot', 'line'] };

      const args = toPlaywrightTestArgs(execArgs, SLUG_PATHS_STUB, REPORTER_PATH);

      expect(args).toContain(`--add-reporter=${REPORTER_PATH},dot,line`);
    });
  });

  describe('GIVEN a base env and a server lease env', (): void => {
    const baseEnv = { path: '/bin', [TURBO_ATOMIZER_ENV]: '0' };
    const leaseEnv = { serverUrl: 'http://localhost:3000', [PLAYWRIGHT_HTML_OPEN_ENV]: 'always' };

    it('WHEN the env is built THEN base and lease values are kept', (): void => {
      const env = toPlaywrightTestEnv(baseEnv, leaseEnv, SLUG_PATHS_STUB);

      expect(env).toMatchObject({ path: '/bin', serverUrl: 'http://localhost:3000' });
    });

    it('WHEN the env is built THEN the atomizer values override both', (): void => {
      const expected = {
        [TURBO_ATOMIZER_ENV]: '1',
        [PLAYWRIGHT_BLOB_OUTPUT_FILE_ENV]: SLUG_PATHS_STUB.blob,
        [PLAYWRIGHT_HTML_OUTPUT_DIR_ENV]: SLUG_PATHS_STUB.html,
        [PLAYWRIGHT_HTML_OPEN_ENV]: 'never',
        [PLAYWRIGHT_JSON_OUTPUT_FILE_ENV]: SLUG_PATHS_STUB.json,
        [PLAYWRIGHT_JUNIT_OUTPUT_FILE_ENV]: SLUG_PATHS_STUB.junit,
        [TURBO_ATOMIZER_COUNT_FILE_ENV]: SLUG_PATHS_STUB.count
      };

      const env = toPlaywrightTestEnv(baseEnv, leaseEnv, SLUG_PATHS_STUB);

      expect(env).toMatchObject(expected);
    });
  });
});
