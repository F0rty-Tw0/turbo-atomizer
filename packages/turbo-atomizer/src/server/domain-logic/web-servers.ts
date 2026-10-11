import { dirname, resolve } from 'node:path';
import type { Writable } from 'node:stream';

import { launchWebServer } from './web-server-launch.ts';
import { TURBO_ATOMIZER_SERVER_ENV_ENV } from '../../shared/atomizer/common/atomizer.const.ts';
import type { AtomizerMetadata, WebServerFact } from '../../shared/atomizer/common/atomizer.type.ts';
import { PlaywrightListException } from '../../shared/playwright/common/playwright-list.exception.ts';
import type { ListSpecsOptions } from '../../shared/playwright/common/spec-listing.type.ts';
import { listSpecs } from '../../shared/playwright/data-access/playwright-list.process.ts';
import { ServerFailedException } from '../common/server-failed.exception.ts';
import type { RunningServer, StartOutcome } from '../common/server.type.ts';
import { stopServer } from '../data-access/server.process.ts';
import { serverEnvOf } from '../utils/server-env.util.ts';

const extraEnv = { [TURBO_ATOMIZER_SERVER_ENV_ENV]: '1' };
const LIST_OPTIONS: ListSpecsOptions = { metadataOnly: true, extraEnv };

const failedStart = (message: string, logTail: string, servers: RunningServer[]): StartOutcome => {
  const outcome: StartOutcome = { ok: false, message, logTail, servers };

  return outcome;
};

const failedStartOf = (error: unknown): StartOutcome => {
  if (error instanceof ServerFailedException) return failedStart(error.details, error.logTail, []);

  if (error instanceof PlaywrightListException) {
    const [summary = ''] = error.message.split('\n');

    return failedStart(summary, error.stderrTail, []);
  }

  return failedStart(String(error), '', []);
};

const isUnshareable = (fact: WebServerFact): boolean => fact.url === undefined && fact.port === undefined;

/** Spec §7 Supervisor steps 1-2: resolve the config in the task's env and refuse servers that cannot be probed. */
const describeServers = async (packageDir: string, configFile: string): Promise<AtomizerMetadata> => {
  const listing = await listSpecs(packageDir, configFile, LIST_OPTIONS);
  const { metadata } = listing;

  if (metadata === undefined) throw new ServerFailedException(`${configFile} is not wrapped in withAtomizer()`, '');

  const unshareable = metadata.webServers.find(isUnshareable);

  if (unshareable !== undefined) {
    throw new ServerFailedException(`webServer "${unshareable.command}" has neither url nor port, so it cannot be shared`, '');
  }

  return metadata;
};

const launchAll = async (metadata: AtomizerMetadata, configDir: string, log: Writable): Promise<StartOutcome> => {
  const captured = metadata.serverEnv ?? {};
  const servers: RunningServer[] = [];
  const env: Record<string, string> = {};

  for (const fact of metadata.webServers) {
    const serverEnv = serverEnvOf(captured, fact.env);
    const outcome = await launchWebServer(fact, configDir, serverEnv, log);

    if (outcome.server !== undefined) servers.push(outcome.server);

    if (!outcome.ok) return failedStart(outcome.message, outcome.logTail, servers);

    Object.assign(env, outcome.env);
  }

  const ready: StartOutcome = { ok: true, env, servers };

  return ready;
};

/** Starts every webServer of the package in order; the outcome always hands back what was spawned so it can be stopped. */
export const startWebServers = async (packageDir: string, configFile: string, log: Writable): Promise<StartOutcome> => {
  const configPath = resolve(packageDir, configFile);

  try {
    const metadata = await describeServers(packageDir, configFile);

    return await launchAll(metadata, dirname(configPath), log);
  } catch (error) {
    return failedStartOf(error);
  }
};

const isRejected = (result: PromiseSettledResult<void>): result is PromiseRejectedResult => result.status === 'rejected';

const reasonOf = (result: PromiseRejectedResult): unknown => result.reason;

/** Waits for every stop to settle, so no server still holds its port once this returns; then rejects with every failure. */
export const stopWebServers = async (servers: RunningServer[]): Promise<void> => {
  const results = await Promise.allSettled(servers.map(stopServer));
  const rejected = results.filter(isRejected);
  const reasons = rejected.map(reasonOf);

  if (reasons.length === 0) return;

  const message = reasons.map(String).join('; ');

  throw new AggregateError(reasons, message);
};
