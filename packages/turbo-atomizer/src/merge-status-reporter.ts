/* eslint-disable local/no-unused-exports -- Playwright loads this reporter by path from the merge config */
import type { FullResult, Reporter } from '@playwright/test/reporter';
import { z } from 'zod';

import { writeMergeStatus } from './reports/data-access/merge-status.store.ts';

const statusFileField = z.string().min(1);

const mergeStatusOptionsSchema = z.object({
  statusFile: statusFileField
});

/**
 * Writes the merged run's status to the `statusFile` option. `playwright merge-reports` 1.64 exits 0 even when the
 * merged report has failures (it exits 1 only on reporter errors), so merge-reports reads this file instead.
 */
export default class MergeStatusReporter implements Reporter {
  private readonly statusFile: string;

  public constructor(options: unknown) {
    const parsed = mergeStatusOptionsSchema.parse(options);

    this.statusFile = parsed.statusFile;
  }

  public async onEnd(result: FullResult): Promise<void> {
    await writeMergeStatus(this.statusFile, result.status);
  }

  // eslint-disable-next-line class-methods-use-this -- Playwright calls it on the reporter instance
  public printsToStdio(): boolean {
    return false;
  }
}
