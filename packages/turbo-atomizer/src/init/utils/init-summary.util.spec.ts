import { describe, expect, it } from 'vitest';

import { formatInitReport, initNextSteps } from './init-summary.util.ts';
import type { SyncResult } from '../../sync/common/sync.type.ts';
import type { InitReport } from '../common/init.type.ts';
import { INIT_REPORT_STUB } from '../test/stubs/init.stub.ts';

describe('FEATURE: init summary', (): void => {
  describe('GIVEN the Playwright config and the test package name', (): void => {
    it('WHEN the next steps are built THEN they wrap the config, declare the app, build, and sync, in that order', (): void => {
      const expected = [
        "Wrap the default export of playwright.config.ts in withAtomizer() from 'turbo-atomizer/playwright'.",
        'Declare the app under test as a workspace dependency of @acme/web-e2e.',
        'Build the workspace dependencies: turbo run build --filter=@acme/web-e2e^...',
        'Run turbo-atomizer sync.'
      ];

      const steps = initNextSteps('playwright.config.ts', '@acme/web-e2e');

      expect(steps).toEqual(expected);
    });
  });

  describe('GIVEN a first run that changed files, warned, and skipped sync', (): void => {
    it('WHEN it is formatted THEN the status, warnings, changes, lockfile reminder and numbered next steps are printed', (): void => {
      const report: InitReport = {
        ...INIT_REPORT_STUB,
        changes: ['turbo.jsonc', '.gitignore'],
        nextSteps: ['Wrap it.', 'Run turbo-atomizer sync.'],
        warnings: ['turbo 2.12.0 is outside the tested range']
      };
      const expectedLines = [
        '/repo/apps/web-e2e: initialized',
        '  warning: turbo 2.12.0 is outside the tested range',
        '  changed: turbo.jsonc',
        '  changed: .gitignore',
        'Commit pnpm-lock.yaml with these changes; the install added the generated package to it.',
        'Next steps:',
        '  1. Wrap it.',
        '  2. Run turbo-atomizer sync.',
        ''
      ];
      const expected = expectedLines.join('\n');

      const text = formatInitReport(report);

      expect(text).toBe(expected);
    });
  });

  describe('GIVEN a re-run that changed nothing and ran sync', (): void => {
    it('WHEN it is formatted THEN it says nothing changed and prints the sync result instead of next steps', (): void => {
      const diff = { added: [], changed: [], removed: [] };
      const sync: SyncResult = { diff, stale: false, written: false };
      const report: InitReport = { ...INIT_REPORT_STUB, sync };
      const expected = '/repo/apps/web-e2e: already initialized; nothing changed\n/repo/apps/web-e2e: up to date\n';

      const text = formatInitReport(report);

      expect(text).toBe(expected);
    });
  });
});
