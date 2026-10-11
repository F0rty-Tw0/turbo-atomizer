import { afterEach, describe, expect, it } from 'vitest';

import { launchOutsideJob } from './windows-launch.process.ts';
import { ServerFailedException } from '../common/server-failed.exception.ts';
import type { WindowsLaunch } from '../common/server.type.ts';
import { installPowerShellStub } from '../test/utils/powershell-stub.spec.util.ts';

const IS_WINDOWS = process.platform === 'win32';

const LAUNCH: WindowsLaunch = { commandLine: '"node" "supervisor.js"', cwd: '.', env: ['PATH=/bin'] };

const SHORT_TIMEOUT_MS = 200;

let restoreStub: (() => Promise<void>) | undefined;

const useStub = async (body: string): Promise<void> => {
  const stub = await installPowerShellStub(body);

  restoreStub = stub.restore;
};

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

  describe.skipIf(IS_WINDOWS)('GIVEN a powershell.exe stub first on PATH', (): void => {
    afterEach(async (): Promise<void> => {
      await restoreStub?.();
      restoreStub = undefined;
    });

    it('WHEN WMI reports a failed Win32_Process.Create THEN the error names the return value and its meaning', async (): Promise<void> => {
      await useStub(`printf '{"returnValue":2,"processId":0}'`);

      const launched = launchOutsideJob(LAUNCH);

      await expect(launched).rejects.toThrow('Win32_Process.Create returned 2 (access denied)');
    });

    it('WHEN it prints something other than a result THEN the error says so and carries its stderr tail', async (): Promise<void> => {
      await useStub(`printf garbage; printf 'Invoke failed: RPC server unavailable\\n' >&2`);

      const launched = launchOutsideJob(LAUNCH);

      await expect(launched).rejects.toThrow(
        'the WMI launch through powershell.exe exited with code 0 with no Win32_Process.Create result'
      );
      await expect(launched).rejects.toThrow('Invoke failed: RPC server unavailable');
    });

    it('WHEN it exits 1 with no output THEN the error names the exit code', async (): Promise<void> => {
      await useStub('exit 1');

      const launched = launchOutsideJob(LAUNCH);

      await expect(launched).rejects.toThrow(
        'the WMI launch through powershell.exe exited with code 1 with no Win32_Process.Create result'
      );
    });

    it('WHEN it outlives the timeout THEN the error says the WMI launch timed out and after how long', async (): Promise<void> => {
      await useStub('exec sleep 5');

      const launched = launchOutsideJob(LAUNCH, SHORT_TIMEOUT_MS);

      await expect(launched).rejects.toThrow(
        'the WMI launch through powershell.exe timed out after 0.2 s with no Win32_Process.Create result'
      );
    });
  });
});
