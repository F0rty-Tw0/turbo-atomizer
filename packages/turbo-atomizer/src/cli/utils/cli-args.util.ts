import { parseArgs } from 'node:util';
import type { ParseArgsOptionDescriptor, ParseArgsOptionsConfig } from 'node:util';

import { CLI_USAGE } from '../common/cli.const.ts';
import type { CliCommand } from '../common/cli.type.ts';

type CommandName = 'affected' | 'doctor' | 'init' | 'merge-reports' | 'sync';

type SplitArgs = {
  readonly own: string[];
  readonly forwarded: string[];
};

type OptionValues = Record<string, boolean | string | (boolean | string)[] | undefined>;

const stringOption: ParseArgsOptionDescriptor = { type: 'string' };
const booleanOption: ParseArgsOptionDescriptor = { type: 'boolean' };
const COMMON_OPTIONS: ParseArgsOptionsConfig = { help: booleanOption, package: stringOption };
const INIT_OPTIONS: ParseArgsOptionsConfig = { 'generated-dir': stringOption };
const SYNC_OPTIONS: ParseArgsOptionsConfig = { check: booleanOption };
const COMMAND_OPTIONS: Record<CommandName, ParseArgsOptionsConfig> = {
  affected: {},
  doctor: {},
  init: INIT_OPTIONS,
  'merge-reports': {},
  sync: SYNC_OPTIONS
};
const HELP_COMMAND: CliCommand = { command: 'usage', exitCode: 0, message: CLI_USAGE };
const VERSION_COMMAND: CliCommand = { command: 'version' };
const FORWARD_SEPARATOR = '--';

const isCommandName = (name: string): name is CommandName => {
  return Object.hasOwn(COMMAND_OPTIONS, name);
};

const usageError = (reason: string): CliCommand => {
  const command: CliCommand = { command: 'usage', exitCode: 2, message: `turbo-atomizer: ${reason}\n\n${CLI_USAGE}` };

  return command;
};

const reasonOf = (error: unknown): string => {
  if (error instanceof Error) return error.message;

  return String(error);
};

const readString = (values: OptionValues, key: string): string | undefined => {
  const value = values[key];

  return typeof value === 'string' ? value : undefined;
};

/** Only `affected` forwards args: everything after the first `--` goes to `turbo run` untouched. */
const splitForwarded = (name: CommandName, args: string[]): SplitArgs => {
  const separatorIndex = args.indexOf(FORWARD_SEPARATOR);
  const forwards = name === 'affected' && separatorIndex !== -1;
  const unsplit: SplitArgs = { own: args, forwarded: [] };

  if (!forwards) return unsplit;

  const own = args.slice(0, separatorIndex);
  const forwarded = args.slice(separatorIndex + 1);
  const split: SplitArgs = { own, forwarded };

  return split;
};

const toCommand = (name: CommandName, values: OptionValues, forwarded: string[]): CliCommand => {
  const packageDir = readString(values, 'package');

  switch (name) {
    case 'affected': {
      const command: CliCommand = { command: 'affected', forwarded, package: packageDir };

      return command;
    }

    case 'init': {
      const generatedDir = readString(values, 'generated-dir');
      const command: CliCommand = { command: 'init', generatedDir, package: packageDir };

      return command;
    }

    case 'sync': {
      const check = values['check'] === true;
      const command: CliCommand = { command: 'sync', check, package: packageDir };

      return command;
    }

    case 'doctor':
    case 'merge-reports': {
      const command: CliCommand = { command: name, package: packageDir };

      return command;
    }
  }
};

const parseCommand = (name: CommandName, args: string[]): CliCommand => {
  const commandOptions = COMMAND_OPTIONS[name];
  const options = { ...COMMON_OPTIONS, ...commandOptions };
  const { own, forwarded } = splitForwarded(name, args);

  try {
    const { values } = parseArgs({ args: own, options, strict: true, allowPositionals: false });

    if (values['help'] === true) return HELP_COMMAND;

    return toCommand(name, values, forwarded);
  } catch (error) {
    const reason = reasonOf(error);

    return usageError(reason);
  }
};

export const parseCliArgs = (argv: string[]): CliCommand => {
  const [name, ...args] = argv;

  if (name === undefined) return usageError('missing command');

  if (name === '--version') return VERSION_COMMAND;

  if (name === '--help') return HELP_COMMAND;

  if (!isCommandName(name)) return usageError(`unknown command "${name}"`);

  return parseCommand(name, args);
};
