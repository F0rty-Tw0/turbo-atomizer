import { describe, expect, it } from 'vitest';

import { parseCliArgs } from './cli-args.util.ts';
import { CLI_USAGE } from '../common/cli.const.ts';
import type { CliCommand } from '../common/cli.type.ts';

describe('FEATURE: CLI arguments', () => {
  describe('GIVEN the sync command', () => {
    it('WHEN --check and --package are passed THEN both are read', () => {
      const expected: CliCommand = { command: 'sync', check: true, package: 'apps/e' };

      const command = parseCliArgs(['sync', '--check', '--package', 'apps/e']);

      expect(command).toEqual(expected);
    });

    it('WHEN no option is passed THEN check is false and no package is set', () => {
      const expected: CliCommand = { command: 'sync', check: false };

      const command = parseCliArgs(['sync']);

      expect(command).toEqual(expected);
    });

    it('WHEN --package uses the = form THEN its value is read', () => {
      const expected: CliCommand = { command: 'sync', check: false, package: 'apps/e' };

      const command = parseCliArgs(['sync', '--package=apps/e']);

      expect(command).toEqual(expected);
    });
  });

  describe('GIVEN the init command', () => {
    it('WHEN --package and --generated-dir are passed THEN both are read', () => {
      const expected: CliCommand = { command: 'init', generatedDir: 'tools/e2e-atoms', package: 'apps/e' };

      const command = parseCliArgs(['init', '--package', 'apps/e', '--generated-dir', 'tools/e2e-atoms']);

      expect(command).toEqual(expected);
    });

    it('WHEN no option is passed THEN neither is set', () => {
      const expected: CliCommand = { command: 'init' };

      const command = parseCliArgs(['init']);

      expect(command).toEqual(expected);
    });
  });

  describe('GIVEN the doctor command', () => {
    it('WHEN --package is passed THEN it is read', () => {
      const expected: CliCommand = { command: 'doctor', package: 'apps/e' };

      const command = parseCliArgs(['doctor', '--package', 'apps/e']);

      expect(command).toEqual(expected);
    });

    it('WHEN the sync-only --check is passed THEN it is a usage error with exit code 2', () => {
      const command = parseCliArgs(['doctor', '--check']);

      expect(command).toMatchObject({ command: 'usage', exitCode: 2 });
    });
  });

  describe('GIVEN the merge-reports command', () => {
    it('WHEN --package is passed THEN it is read', () => {
      const expected: CliCommand = { command: 'merge-reports', package: 'apps/e' };

      const command = parseCliArgs(['merge-reports', '--package', 'apps/e']);

      expect(command).toEqual(expected);
    });
  });

  describe('GIVEN a top-level flag', () => {
    it('WHEN --version is passed THEN the version command is returned', () => {
      const expected: CliCommand = { command: 'version' };

      const command = parseCliArgs(['--version']);

      expect(command).toEqual(expected);
    });

    it('WHEN --help is passed THEN the usage is returned with exit code 0', () => {
      const expected: CliCommand = { command: 'usage', exitCode: 0, message: CLI_USAGE };

      const command = parseCliArgs(['--help']);

      expect(command).toEqual(expected);
    });

    it('WHEN --help follows a command THEN the usage is returned with exit code 0', () => {
      const expected: CliCommand = { command: 'usage', exitCode: 0, message: CLI_USAGE };

      const command = parseCliArgs(['sync', '--help']);

      expect(command).toEqual(expected);
    });
  });

  describe('GIVEN invalid input', () => {
    it('WHEN the command is unknown THEN a usage error with exit code 2 names it', () => {
      const command = parseCliArgs(['nope']);

      expect(command).toEqual({ command: 'usage', exitCode: 2, message: `turbo-atomizer: unknown command "nope"\n\n${CLI_USAGE}` });
    });

    it('WHEN no command is given THEN it is a usage error with exit code 2', () => {
      const command = parseCliArgs([]);

      expect(command).toEqual({ command: 'usage', exitCode: 2, message: `turbo-atomizer: missing command\n\n${CLI_USAGE}` });
    });

    it('WHEN an unknown option is passed THEN a usage error with exit code 2 names it', () => {
      const namesOption: unknown = expect.stringContaining('--bogus');

      const command = parseCliArgs(['sync', '--bogus']);

      expect(command).toMatchObject({ command: 'usage', exitCode: 2, message: namesOption });
    });

    it('WHEN --package has no value THEN it is a usage error with exit code 2', () => {
      const namesOption: unknown = expect.stringContaining('--package');

      const command = parseCliArgs(['sync', '--package']);

      expect(command).toMatchObject({ command: 'usage', exitCode: 2, message: namesOption });
    });

    it('WHEN a positional argument follows the command THEN it is a usage error with exit code 2', () => {
      const namesArgument: unknown = expect.stringContaining('apps/e');

      const command = parseCliArgs(['sync', 'apps/e']);

      expect(command).toMatchObject({ command: 'usage', exitCode: 2, message: namesArgument });
    });
  });
});
