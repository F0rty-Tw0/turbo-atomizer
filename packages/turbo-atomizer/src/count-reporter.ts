/* eslint-disable local/no-unused-exports -- Playwright loads this reporter by path through --add-reporter */
import type { FullConfig, Reporter, Suite } from '@playwright/test/reporter';

import { getAtomizerEnv } from './config/atomizer-env.schema.ts';
import { recordSelectedCount } from './exec/domain-logic/count-report.ts';

/** Writes `{ "selected": n }` to `TURBO_ATOMIZER_COUNT_FILE` once Playwright has built the root suite. */
export default class CountReporter implements Reporter {
  private recording: Promise<void> = Promise.resolve();

  public onBegin(_config: FullConfig, suite: Suite): void {
    const countFile = getAtomizerEnv().countFile;

    if (countFile === undefined) return;

    this.recording = recordSelectedCount(countFile, suite.allTests().length);
  }

  public async onEnd(): Promise<void> {
    await this.recording;
  }

  // eslint-disable-next-line class-methods-use-this -- Playwright calls it on the reporter instance
  public printsToStdio(): boolean {
    return false;
  }
}
