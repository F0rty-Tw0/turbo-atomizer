import { describe, expect, it } from 'vitest';

import { launchOutsideJob } from './windows-launch.process.ts';
import { ServerFailedException } from '../common/server-failed.exception.ts';
import type { WindowsLaunch } from '../common/server.type.ts';

const IS_WINDOWS = process.platform === 'win32';

const LAUNCH: WindowsLaunch = { commandLine: '"node" "supervisor.js"', cwd: '.', env: ['PATH=/bin'] };

describe('FEATURE: Windows launch through WMI', (): void => {
  describe.skipIf(IS_WINDOWS)('GIVEN a machine without powershell.exe, as WMI is unreachable', (): void => {
    it('WHEN a launch is attempted THEN it fails naming powershell.exe, WMI and why the job must be escaped', async (): Promise<void> => {
      const launched = launchOutsideJob(LAUNCH);

      await expect(launched).rejects.toThrow(ServerFailedException);
      await expect(launched).rejects.toThrow(
        "could not start the supervisor outside turbo's task job (it kills detached children on exit): powershell.exe, which reaches WMI, could not start"
      );
    });
  });
});
