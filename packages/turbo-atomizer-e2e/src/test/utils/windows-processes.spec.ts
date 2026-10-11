import { describe, expect, it } from 'vitest';

import { descendantPids } from './windows-processes.spec.util.ts';
import type { WindowsProcess } from '../common/workspace-process.type.ts';

const TURBO: WindowsProcess = { pid: 100, parentPid: 1, name: 'turbo.exe', commandLine: 'turbo run e2e-ci', createdAt: 2_000 };

const TASK: WindowsProcess = { pid: 200, parentPid: 100, name: 'node.exe', commandLine: 'node exec', createdAt: 2_100 };

const BROWSER: WindowsProcess = { pid: 300, parentPid: 200, name: 'chrome-headless-shell.exe', commandLine: '', createdAt: 2_200 };

describe('FEATURE: windows processes', (): void => {
  describe('GIVEN a turbo.exe with a task child and a browser grandchild', (): void => {
    it('WHEN its descendants are walked THEN the child and the grandchild are found', (): void => {
      const processes = [TURBO, TASK, BROWSER];

      const pids = descendantPids(processes, TURBO.pid);

      expect(pids).toEqual([TASK.pid, BROWSER.pid]);
    });

    it('WHEN an orphan created before turbo.exe names turbo.exe pid as its parent THEN the orphan is not a descendant', (): void => {
      const orphan: WindowsProcess = { pid: 400, parentPid: TURBO.pid, name: 'node.exe', commandLine: 'stale', createdAt: 1_000 };
      const processes = [TURBO, TASK, orphan];

      const pids = descendantPids(processes, TURBO.pid);

      expect(pids).toEqual([TASK.pid]);
    });

    it('WHEN turbo.exe is not in the listing THEN no descendant is found', (): void => {
      const processes = [TASK, BROWSER];

      const pids = descendantPids(processes, TURBO.pid);

      expect(pids).toEqual([]);
    });
  });
});
