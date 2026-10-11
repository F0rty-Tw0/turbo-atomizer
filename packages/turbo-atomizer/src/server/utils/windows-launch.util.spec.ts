import { describe, expect, it } from 'vitest';

import { createdPid, quoteWindowsArg, toEnvironmentStrings, toLaunchStdin, toSupervisorLaunch } from './windows-launch.util.ts';
import { ServerFailedException } from '../common/server-failed.exception.ts';
import type { SupervisorStart } from '../common/server.type.ts';

const START: SupervisorStart = {
  execPath: 'C:\\Program Files\\nodejs\\node.exe',
  supervisorPath: 'C:\\repo\\node_modules\\turbo-atomizer\\dist\\supervisor.js',
  packageDir: 'C:\\repo\\apps\\web-e2e',
  configFile: 'playwright.config.ts'
};

const SECRET = 's3cr3t-token-value';

describe('FEATURE: Windows supervisor launch', (): void => {
  describe('GIVEN an argument for a Windows command line', (): void => {
    it('WHEN it holds spaces THEN it is quoted whole', (): void => {
      expect(quoteWindowsArg('C:\\Program Files\\nodejs\\node.exe')).toBe('"C:\\Program Files\\nodejs\\node.exe"');
    });

    it('WHEN it ends in a backslash THEN that backslash is doubled so it does not escape the closing quote', (): void => {
      expect(quoteWindowsArg('C:\\dir\\')).toBe('"C:\\dir\\\\"');
    });

    it('WHEN it holds a quote after backslashes THEN the backslashes are doubled and the quote is escaped', (): void => {
      expect(quoteWindowsArg('a\\"b')).toBe('"a\\\\\\"b"');
    });

    it('WHEN it holds backslashes not before a quote THEN they stay as they are', (): void => {
      expect(quoteWindowsArg('a\\b\\c')).toBe('"a\\b\\c"');
    });

    it('WHEN it is empty THEN it is an empty quoted argument', (): void => {
      expect(quoteWindowsArg('')).toBe('""');
    });
  });

  describe('GIVEN a process environment', (): void => {
    it('WHEN it is turned into Win32_ProcessStartup entries THEN unset values and hidden =C: entries are dropped', (): void => {
      const env: NodeJS.ProcessEnv = { PATH: 'C:\\bin', ['=C:']: 'C:\\repo', EMPTY: '', UNSET: undefined };

      expect(toEnvironmentStrings(env)).toEqual(['PATH=C:\\bin', 'EMPTY=']);
    });

    it('WHEN a value holds = signs THEN only the first = separates the name', (): void => {
      expect(toEnvironmentStrings({ ['NODE_OPTIONS']: '--a=b' })).toEqual(['NODE_OPTIONS=--a=b']);
    });
  });

  describe('GIVEN a supervisor to start outside turbo job', (): void => {
    it('WHEN the launch is built THEN the command line runs the supervisor entry with --spawn in the package dir', (): void => {
      const launch = toSupervisorLaunch(START, {});

      expect(launch.commandLine).toBe(
        '"C:\\Program Files\\nodejs\\node.exe" "C:\\repo\\node_modules\\turbo-atomizer\\dist\\supervisor.js" "--spawn" "C:\\repo\\apps\\web-e2e" "playwright.config.ts"'
      );
      expect(launch.cwd).toBe(START.packageDir);
    });

    it('WHEN the env holds a secret THEN it travels in env only and never in the command line', (): void => {
      const launch = toSupervisorLaunch(START, { ['TURBO_TOKEN']: SECRET });

      expect(launch.env).toEqual([`TURBO_TOKEN=${SECRET}`]);
      expect(launch.commandLine).not.toContain(SECRET);
    });
  });

  describe('GIVEN a launch to send to the launch script', (): void => {
    it('WHEN it is serialized for powershell stdin THEN command line, cwd and each env entry are NUL-separated in that order', (): void => {
      const launch = { commandLine: '"node" "a b"', cwd: 'C:\\Users\\Zoë', env: ['PATH=C:\\bin', 'GREETING=héllo 世界'] };

      expect(toLaunchStdin(launch)).toBe('"node" "a b"\0C:\\Users\\Zoë\0PATH=C:\\bin\0GREETING=héllo 世界');
    });
  });

  describe('GIVEN the result Win32_Process.Create reported', (): void => {
    it('WHEN it returned 0 THEN the created pid is returned', (): void => {
      expect(createdPid({ returnValue: 0, processId: 4652 })).toBe(4652);
    });

    it('WHEN it returned a known failure THEN the error names it', (): void => {
      const create = (): number => createdPid({ returnValue: 2, processId: 0 });

      expect(create).toThrow(ServerFailedException);
      expect(create).toThrow('Win32_Process.Create returned 2 (access denied)');
    });

    it('WHEN it returned an undocumented value THEN the error still names the value', (): void => {
      const create = (): number => createdPid({ returnValue: 99, processId: 0 });

      expect(create).toThrow('Win32_Process.Create returned 99 (undocumented return value)');
    });
  });
});
