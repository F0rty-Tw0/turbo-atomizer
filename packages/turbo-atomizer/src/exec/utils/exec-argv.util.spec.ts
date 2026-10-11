import { describe, expect, it } from 'vitest';

import { parseExecArgv } from './exec-argv.util.ts';

type FilterCase = {
  readonly args: string[];
  readonly hasFilter: boolean;
};

const TASK_ARGV = ['tests/a.spec.ts', 'a.spec.ts'];
const FIXED_ARGV = [...TASK_ARGV, '--atomizer-blob', '--config=pw.ts', '--fail-on-flaky-tests'];
const NO_ENV_ARGS: string[] = [];

const NON_FILTER_CASES: FilterCase[] = [
  { args: ['--workers', '4'], hasFilter: false },
  { args: ['-j', '4'], hasFilter: false },
  { args: ['-j4'], hasFilter: false },
  { args: ['--workers=4'], hasFilter: false },
  { args: ['--shuffle', '42'], hasFilter: false },
  { args: ['-u', 'changed'], hasFilter: false },
  { args: ['-uchanged'], hasFilter: false },
  { args: ['--debug', 'cli'], hasFilter: false },
  { args: ['--shuffle', '--headed'], hasFilter: false },
  { args: ['--update-snapshots'], hasFilter: false },
  { args: ['--config=pw.ts', '--fail-on-flaky-tests'], hasFilter: false },
  { args: ['--', 'tests/b.spec.ts'], hasFilter: false }
];

const FILTER_CASES: FilterCase[] = [
  { args: ['--grep=@smoke'], hasFilter: true },
  { args: ['-g', '@smoke'], hasFilter: true },
  { args: ['-gfoo'], hasFilter: true },
  { args: ['-G', 'slow'], hasFilter: true },
  { args: ['--grep-invert=slow'], hasFilter: true },
  { args: ['--shard', '1/2'], hasFilter: true },
  { args: ['--shard=1/2'], hasFilter: true },
  { args: ['--project', 'a', 'b', '--headed'], hasFilter: true },
  { args: ['--project=a'], hasFilter: true },
  { args: ['--last-failed'], hasFilter: true },
  { args: ['--only-changed'], hasFilter: true },
  { args: ['--only-changed', 'main'], hasFilter: true },
  { args: ['tests/b.spec.ts'], hasFilter: true },
  { args: ['--headed', 'b.spec.ts'], hasFilter: true },
  { args: ['--shuffle', '--headed', 'b.spec.ts'], hasFilter: true }
];

describe('FEATURE: exec argv', () => {
  describe('GIVEN a task path, a list line, the blob exec flag and fixed args', () => {
    const argv = [...TASK_ARGV, '--atomizer-blob', '--config=pw.ts', '--grep', 'x'];

    it('WHEN parsed THEN the task path and list line are the first two args', () => {
      const execArgs = parseExecArgv(argv, NO_ENV_ARGS);

      expect([execArgs.taskPath, execArgs.listLine]).toEqual(TASK_ARGV);
    });

    it('WHEN parsed THEN the blob reporter is needed', () => {
      const execArgs = parseExecArgv(argv, NO_ENV_ARGS);

      expect(execArgs.needsBlob).toBe(true);
    });

    it('WHEN parsed THEN the Playwright args omit the exec flag', () => {
      const execArgs = parseExecArgv(argv, NO_ENV_ARGS);

      expect(execArgs.playwrightArgs).toEqual(['--config=pw.ts', '--grep', 'x']);
    });

    it('WHEN parsed THEN a filter is detected', () => {
      const execArgs = parseExecArgv(argv, NO_ENV_ARGS);

      expect(execArgs.hasFilter).toBe(true);
    });
  });

  describe('GIVEN a Playwright config arg', () => {
    it.each([['--config=pw.ts'], ['--config', 'pw.ts'], ['-c', 'pw.ts'], ['-cpw.ts']])(
      'WHEN %s is parsed THEN the config file is pw.ts',
      (...args) => {
        const execArgs = parseExecArgv([...TASK_ARGV, ...args], NO_ENV_ARGS);

        expect(execArgs.configFile).toBe('pw.ts');
      }
    );

    it('WHEN a forwarded config follows the fixed one THEN the last config file wins', () => {
      const execArgs = parseExecArgv([...TASK_ARGV, '--config=pw.ts', '-c', 'other.ts'], NO_ENV_ARGS);

      expect(execArgs.configFile).toBe('other.ts');
    });

    it('WHEN none is given THEN the config file is undefined', () => {
      const execArgs = parseExecArgv([...TASK_ARGV, '--headed'], NO_ENV_ARGS);

      expect(execArgs.configFile).toBeUndefined();
    });
  });

  describe('GIVEN no blob exec flag', () => {
    it('WHEN parsed THEN the blob reporter is not needed', () => {
      const execArgs = parseExecArgv([...TASK_ARGV, '--config=pw.ts'], NO_ENV_ARGS);

      expect(execArgs.needsBlob).toBe(false);
    });
  });

  describe('GIVEN fewer than two args', () => {
    it('WHEN parsed THEN it throws', () => {
      const parse = (): void => {
        parseExecArgv(['tests/a.spec.ts'], NO_ENV_ARGS);
      };

      expect(parse).toThrow('<task path> <list line>');
    });
  });

  describe('GIVEN forwarded args that only set option values', () => {
    it.each(NON_FILTER_CASES)('WHEN $args is forwarded THEN no filter is detected', ({ args, hasFilter }) => {
      const execArgs = parseExecArgv([...TASK_ARGV, ...args], NO_ENV_ARGS);

      expect(execArgs.hasFilter).toBe(hasFilter);
    });

    it.each(NON_FILTER_CASES)('WHEN $args is forwarded THEN the Playwright args keep every token', ({ args }) => {
      const execArgs = parseExecArgv([...TASK_ARGV, ...args], NO_ENV_ARGS);

      expect(execArgs.playwrightArgs).toEqual(args);
    });
  });

  describe('GIVEN forwarded filtering args', () => {
    it.each(FILTER_CASES)('WHEN $args is forwarded THEN a filter is detected', ({ args, hasFilter }) => {
      const execArgs = parseExecArgv([...TASK_ARGV, ...args], NO_ENV_ARGS);

      expect(execArgs.hasFilter).toBe(hasFilter);
    });
  });

  describe('GIVEN a forwarded --add-reporter', () => {
    it.each([['--add-reporter=dot'], ['--add-reporter', 'dot']])('WHEN %s is forwarded THEN its value is extracted', (...args) => {
      const execArgs = parseExecArgv([...TASK_ARGV, ...args], NO_ENV_ARGS);

      expect(execArgs.forwardedReporters).toEqual(['dot']);
    });

    it.each([['--add-reporter=dot'], ['--add-reporter', 'dot']])(
      'WHEN %s is forwarded THEN it is removed from the Playwright args',
      (...args) => {
        const execArgs = parseExecArgv([...TASK_ARGV, ...args, '--headed'], NO_ENV_ARGS);

        expect(execArgs.playwrightArgs).toEqual(['--headed']);
      }
    );

    it('WHEN both forms are forwarded THEN every value is extracted in order', () => {
      const execArgs = parseExecArgv([...TASK_ARGV, '--add-reporter', 'dot', '--headed', '--add-reporter=line'], NO_ENV_ARGS);

      expect(execArgs.forwardedReporters).toEqual(['dot', 'line']);
    });

    it('WHEN it is the value of --grep THEN it stays a Playwright arg', () => {
      const execArgs = parseExecArgv([...TASK_ARGV, '--grep', '--add-reporter'], NO_ENV_ARGS);

      expect(execArgs.playwrightArgs).toEqual(['--grep', '--add-reporter']);
    });

    it('WHEN it has no value THEN it stays a Playwright arg', () => {
      const execArgs = parseExecArgv([...TASK_ARGV, '--add-reporter'], NO_ENV_ARGS);

      expect(execArgs.playwrightArgs).toEqual(['--add-reporter']);
    });

    it('WHEN it follows -- THEN it stays a Playwright arg', () => {
      const execArgs = parseExecArgv([...TASK_ARGV, '--', '--add-reporter', 'dot'], NO_ENV_ARGS);

      expect(execArgs.forwardedReporters).toEqual([]);
    });
  });

  describe('GIVEN TURBO_ATOMIZER_ARGS args', () => {
    it('WHEN parsed THEN they follow the fixed args and precede the forwarded args', () => {
      const execArgs = parseExecArgv([...FIXED_ARGV, '--headed'], ['--workers', '2']);

      expect(execArgs.playwrightArgs).toEqual(['--config=pw.ts', '--fail-on-flaky-tests', '--workers', '2', '--headed']);
    });

    it('WHEN nothing is forwarded THEN they follow the fixed args', () => {
      const execArgs = parseExecArgv(FIXED_ARGV, ['--headed']);

      expect(execArgs.playwrightArgs).toEqual(['--config=pw.ts', '--fail-on-flaky-tests', '--headed']);
    });

    it('WHEN they hold --grep=@smoke THEN a filter is detected', () => {
      const execArgs = parseExecArgv(FIXED_ARGV, ['--grep=@smoke']);

      expect(execArgs.hasFilter).toBe(true);
    });

    it('WHEN they and the forwarded args add reporters THEN the env reporters come first', () => {
      const execArgs = parseExecArgv([...FIXED_ARGV, '--add-reporter=line'], ['--add-reporter', 'dot']);

      expect(execArgs.forwardedReporters).toEqual(['dot', 'line']);
    });

    it('WHEN they add a reporter THEN it is removed from the Playwright args', () => {
      const execArgs = parseExecArgv(FIXED_ARGV, ['--add-reporter', 'dot', '--headed']);

      expect(execArgs.playwrightArgs).toEqual(['--config=pw.ts', '--fail-on-flaky-tests', '--headed']);
    });

    it('WHEN they set a config THEN it overrides the fixed config', () => {
      const execArgs = parseExecArgv(FIXED_ARGV, ['-c', 'env.ts']);

      expect(execArgs.configFile).toBe('env.ts');
    });

    it('WHEN a forwarded config follows THEN the forwarded config wins', () => {
      const execArgs = parseExecArgv([...FIXED_ARGV, '-c', 'forwarded.ts'], ['-c', 'env.ts']);

      expect(execArgs.configFile).toBe('forwarded.ts');
    });
  });
});
