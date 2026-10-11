import { posix } from 'node:path';

import { toAtomSlug } from './atom-slug.util.ts';
import {
  ATOMIZER_BLOB_FLAG,
  ATOMIZER_CARRIER_TAG,
  ATOMIZER_CONFIG_FILE,
  ATOMIZER_LIVE_TAG,
  ATOMIZER_OUTPUT_DIR,
  ATOMIZER_TASK_TAG_PREFIX,
  CARRIER_TASK_INFIX,
  TURBO_ATOMIZER_ARGS_ENV
} from '../../shared/atomizer/common/atomizer.const.ts';
import type { AtomTask, AtomTaskInput, TurboTask, TurboTaskDefinition } from '../common/atom-task.type.ts';

const EXEC_COMMAND = ['node', '-e', "require('turbo-atomizer/exec')"];
const FAIL_ON_FLAKY_FLAG = '--fail-on-flaky-tests';
// turbo rejects an empty-string argument, so the carrier runs a no-op script instead of `node -e ''`.
const CARRIER_COMMAND = ['node', '-e', '0'];

const negate = (glob: string): string => `!${glob}`;

const onlyIf = (condition: boolean, items: string[]): string[] => {
  if (!condition) return [];

  return items;
};

const fileCommand = (input: AtomTaskInput): string[] => {
  const blobFlags = onlyIf(input.needsBlob, [ATOMIZER_BLOB_FLAG]);
  const flakyFlags = onlyIf(input.config.failOnFlaky, [FAIL_ON_FLAKY_FLAG]);
  const configFlag = `--config=${input.config.playwrightConfig}`;

  return [...EXEC_COMMAND, input.taskPath, input.listLine, ...blobFlags, configFlag, ...flakyFlags];
};

const fileInputs = (input: AtomTaskInput): string[] => {
  const { config } = input;
  const specExclusions = config.specGlobs.map(negate);
  const snapshotGlobExclusions = config.snapshotGlobs.map(negate);
  const snapshotExclusions = onlyIf(!input.snapshotsShared, snapshotGlobExclusions);
  const configFileExclusion = negate(ATOMIZER_CONFIG_FILE);
  const configExclusions = onlyIf(input.configInFile, [configFileExclusion]);

  return ['$TURBO_DEFAULT$', ...specExclusions, ...snapshotExclusions, ...configExclusions, ...config.extraInputs];
};

const fileOutputs = (taskPath: string): string[] => {
  const slugDir = `${ATOMIZER_OUTPUT_DIR}/${toAtomSlug(taskPath)}`;

  return [`${slugDir}/**`, `!${slugDir}/test-results/**`];
};

const liveCommitEnvs = (input: AtomTaskInput, isLive: boolean): string[] => {
  const { commitEnv } = input.config.uncached;

  if (commitEnv === undefined) return [];

  return onlyIf(isLive, [commitEnv]);
};

const fileEnv = (input: AtomTaskInput, isLive: boolean): string[] => {
  const commitEnvs = liveCommitEnvs(input, isLive);
  const names = new Set([...input.config.env, ...commitEnvs, TURBO_ATOMIZER_ARGS_ENV]);

  return [...names];
};

const isLiveSpec = (input: AtomTaskInput): boolean => {
  const matchesTaskPath = (pattern: string): boolean => posix.matchesGlob(input.taskPath, pattern);

  return input.config.uncached.patterns.some(matchesTaskPath);
};

const buildFileTask = (input: AtomTaskInput, carrierName: string): TurboTask => {
  const { config } = input;
  const isLive = isLiveSpec(input);
  const isUncached = isLive && config.uncached.commitEnv === undefined;
  const liveTags = onlyIf(isLive, [ATOMIZER_LIVE_TAG]);
  const definition: TurboTaskDefinition = {
    command: fileCommand(input),
    dependsOn: [...config.dependsOn, carrierName],
    inputs: fileInputs(input),
    outputs: fileOutputs(input.taskPath),
    env: fileEnv(input, isLive),
    passThroughEnv: config.passThroughEnv,
    cache: !isUncached,
    tags: [`${ATOMIZER_TASK_TAG_PREFIX}${config.task}`, ...liveTags]
  };
  const fileTask: TurboTask = { definition, name: `${config.task}--${input.taskPath}` };

  return fileTask;
};

const buildCarrier = (input: AtomTaskInput, name: string): TurboTask => {
  const snapshotInputs = onlyIf(!input.snapshotsShared, [`${input.taskPath}-snapshots/**`]);
  const definition: TurboTaskDefinition = {
    command: CARRIER_COMMAND,
    inputs: [input.taskPath, ...snapshotInputs],
    tags: [ATOMIZER_CARRIER_TAG]
  };
  const carrier: TurboTask = { definition, name };

  return carrier;
};

/** One spec's file task and the carrier that brings the spec and its snapshots into the file task's hash (spec §4). */
export const buildAtomTask = (input: AtomTaskInput): AtomTask => {
  const carrierName = `${input.config.task}${CARRIER_TASK_INFIX}${input.taskPath}`;
  const carrier = buildCarrier(input, carrierName);
  const file = buildFileTask(input, carrierName);
  const atomTask: AtomTask = { carrier, file };

  return atomTask;
};
