import { ATOMIZER_BLOB_FLAG } from '../../shared/atomizer/common/atomizer.const.ts';
import type { ExecArgs } from '../common/exec.type.ts';
import {
  ADD_REPORTER_OPTION,
  CONFIG_OPTIONS,
  FILTER_OPTIONS,
  OPTIONAL_VALUE_OPTIONS,
  VALUE_OPTIONS,
  VARIADIC_OPTIONS
} from '../common/playwright-options.const.ts';

type ParsedArg = {
  readonly kind: 'option' | 'positional' | 'rest';
  readonly name: string;
  readonly tokens: string[];
  readonly values: string[];
};

type AttachedValue = {
  readonly name: string;
  readonly value: string;
};

const EXEC_FLAG_PREFIX = '--atomizer-';

const FIXED_CONFIG_PREFIX = '--config=';

const FIXED_FAIL_ON_FLAKY_FLAG = '--fail-on-flaky-tests';

const isOptionLike = (token: string): boolean => {
  return token.length > 1 && token.startsWith('-');
};

const takesValue = (name: string): boolean => {
  const isValue = VALUE_OPTIONS.includes(name);
  const isOptional = OPTIONAL_VALUE_OPTIONS.includes(name);
  const isVariadic = VARIADIC_OPTIONS.includes(name);

  return isValue || isOptional || isVariadic;
};

const takeValues = (name: string, queue: string[]): string[] => {
  const next = queue[0];

  if (next === undefined) return [];

  const isOptional = OPTIONAL_VALUE_OPTIONS.includes(name);
  const isNextOption = isOptionLike(next);

  if (isOptional && isNextOption) return [];

  const values = queue.splice(0, 1);
  const isVariadic = VARIADIC_OPTIONS.includes(name);

  if (!isVariadic) return values;

  const nextOptionIndex = queue.findIndex(isOptionLike);
  const extraCount = nextOptionIndex === -1 ? queue.length : nextOptionIndex;
  const extraValues = queue.splice(0, extraCount);

  return [...values, ...extraValues];
};

const splitAttachedValue = (token: string, nameEnd: number, valueStart: number): AttachedValue | undefined => {
  const name = token.slice(0, nameEnd);
  const isValueOption = takesValue(name);

  if (!isValueOption) return undefined;

  const value = token.slice(valueStart);
  const attached: AttachedValue = { name, value };

  return attached;
};

const attachedValue = (token: string): AttachedValue | undefined => {
  const isLong = token.startsWith('--');

  if (token.length === 2) return undefined;

  if (!isLong) return splitAttachedValue(token, 2, 2);

  const separatorIndex = token.indexOf('=');

  if (separatorIndex === -1) return undefined;

  const valueStart = separatorIndex + 1;

  return splitAttachedValue(token, separatorIndex, valueStart);
};

const parseOption = (token: string, queue: string[]): ParsedArg => {
  const attached = attachedValue(token);

  if (attached !== undefined) {
    const attachedOption: ParsedArg = { kind: 'option', name: attached.name, tokens: [token], values: [attached.value] };

    return attachedOption;
  }

  const isValueOption = takesValue(token);

  if (!isValueOption) {
    const flag: ParsedArg = { kind: 'option', name: token, tokens: [token], values: [] };

    return flag;
  }

  const values = takeValues(token, queue);
  const tokens = [token, ...values];
  const option: ParsedArg = { kind: 'option', name: token, tokens, values };

  return option;
};

const parseNext = (token: string, queue: string[]): ParsedArg => {
  if (token === '--') {
    const restTokens = queue.splice(0);
    const rest: ParsedArg = { kind: 'rest', name: token, tokens: [token, ...restTokens], values: [] };

    return rest;
  }

  const isOption = isOptionLike(token);

  if (isOption) return parseOption(token, queue);

  const positional: ParsedArg = { kind: 'positional', name: token, tokens: [token], values: [] };

  return positional;
};

const parseArgs = (tokens: string[]): ParsedArg[] => {
  const queue = [...tokens];
  const parsedArgs: ParsedArg[] = [];

  for (let token = queue.shift(); token !== undefined; token = queue.shift()) {
    const parsedArg = parseNext(token, queue);

    parsedArgs.push(parsedArg);
  }

  return parsedArgs;
};

const isBlobFlag = (arg: ParsedArg): boolean => {
  return arg.kind === 'option' && arg.name === ATOMIZER_BLOB_FLAG;
};

const isForwardedReporter = (arg: ParsedArg): boolean => {
  return arg.name === ADD_REPORTER_OPTION && arg.values.length > 0;
};

const isPlaywrightArg = (arg: ParsedArg): boolean => {
  const isBlob = isBlobFlag(arg);
  const isReporter = isForwardedReporter(arg);

  return !isBlob && !isReporter;
};

const isConfigArg = (arg: ParsedArg): boolean => {
  return arg.kind === 'option' && CONFIG_OPTIONS.includes(arg.name);
};

const isFilterArg = (arg: ParsedArg): boolean => {
  const isFilterOption = arg.kind === 'option' && FILTER_OPTIONS.includes(arg.name);

  return arg.kind === 'positional' || isFilterOption;
};

const isForwardedArg = (token: string): boolean => {
  const isExecFlag = token.startsWith(EXEC_FLAG_PREFIX);
  const isFixedConfig = token.startsWith(FIXED_CONFIG_PREFIX);
  const isFixedFailOnFlaky = token === FIXED_FAIL_ON_FLAKY_FLAG;

  return !isExecFlag && !isFixedConfig && !isFixedFailOnFlaky;
};

/** Spec §6.3 step 5: `TURBO_ATOMIZER_ARGS` args go after the exec flags and fixed args sync generates, before the args turbo forwards. */
const withEnvArgs = (rest: string[], envArgs: string[]): string[] => {
  const forwardedIndex = rest.findIndex(isForwardedArg);
  const fixedCount = forwardedIndex === -1 ? rest.length : forwardedIndex;
  const fixedArgs = rest.slice(0, fixedCount);
  const forwardedArgs = rest.slice(fixedCount);

  return [...fixedArgs, ...envArgs, ...forwardedArgs];
};

/** Parses exec's argv; `envArgs` are the parsed `TURBO_ATOMIZER_ARGS`, read as one list with the forwarded args. */
export const parseExecArgv = (argv: string[], envArgs: string[]): ExecArgs => {
  const [taskPath, listLine, ...rest] = argv;

  if (taskPath === undefined || listLine === undefined) throw new Error(`exec needs <task path> <list line>, got: ${argv.join(' ')}`);

  const tokens = withEnvArgs(rest, envArgs);
  const parsedArgs = parseArgs(tokens);
  const playwrightArgs = parsedArgs.filter(isPlaywrightArg).flatMap((arg) => arg.tokens);
  const forwardedReporters = parsedArgs.filter(isForwardedReporter).flatMap((arg) => arg.values);
  const configFiles = parsedArgs.filter(isConfigArg).flatMap((arg) => arg.values);
  const configFile = configFiles.at(-1);
  const needsBlob = parsedArgs.some(isBlobFlag);
  const hasFilter = parsedArgs.some(isFilterArg);
  const execArgs: ExecArgs = { taskPath, listLine, needsBlob, configFile, playwrightArgs, forwardedReporters, hasFilter };

  return execArgs;
};
