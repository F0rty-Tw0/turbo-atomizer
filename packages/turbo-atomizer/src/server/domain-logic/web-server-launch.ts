import { resolve } from 'node:path';
import type { Writable } from 'node:stream';
import { setTimeout as sleep } from 'node:timers/promises';
import { stripVTControlCharacters } from 'node:util';

import type { WaitFact, WebServerFact } from '../../shared/atomizer/common/atomizer.type.ts';
import { DEFAULT_SERVER_TIMEOUT_MS, LOG_TAIL_LINES } from '../common/server.const.ts';
import type { LaunchOutcome, RunningServer, ServerChild } from '../common/server.type.ts';
import { probeServer } from '../data-access/probe.http.ts';
import { spawnServer } from '../data-access/server.process.ts';
import { lastLines } from '../utils/log-tail.util.ts';
import { nextProbeDelay } from '../utils/probe-schedule.util.ts';
import { matchWaitPattern } from '../utils/wait-pattern.util.ts';

type OutputStream = 'stdout' | 'stderr';

type ServerOutput = {
  readonly captured: () => Record<string, string> | undefined;
  readonly closed: Promise<void>;
  readonly exit: () => string | undefined;
  readonly tail: () => string;
};

const failedLaunch = (message: string, logTail: string, server: RunningServer): LaunchOutcome => {
  const outcome: LaunchOutcome = { ok: false, message, logTail, server };

  return outcome;
};

/** Forwards output to the log, keeps the last lines, and matches `wait` patterns; without patterns `captured` starts satisfied. */
const watchOutput = (child: ServerChild, wait: WaitFact | undefined, log: Writable): ServerOutput => {
  const collected: Record<OutputStream, string> = { stdout: '', stderr: '' };
  const hasWait = wait?.stdout !== undefined || wait?.stderr !== undefined;
  const noGroups: Record<string, string> = {};
  let captured: Record<string, string> | undefined = hasWait ? undefined : noGroups;
  let tail = '';
  let exit: string | undefined;

  const onChunk = (stream: OutputStream, chunk: Buffer): void => {
    const text = stripVTControlCharacters(chunk.toString());
    const pattern = wait?.[stream];

    log.write(chunk);
    tail = lastLines(tail + text, LOG_TAIL_LINES);

    if (captured !== undefined || pattern === undefined) return;

    collected[stream] += text;
    captured = matchWaitPattern(pattern, collected[stream]);
  };

  const closed = new Promise<void>((settle): void => {
    child.once('close', (code, signal): void => {
      const byCode = `code ${String(code)}`;
      const bySignal = `signal ${String(signal)}`;

      exit = signal === null ? byCode : bySignal;
      settle();
    });
    child.once('error', (error): void => {
      exit = error.message;
      settle();
    });
  });

  child.stdout.on('data', (chunk: Buffer): void => onChunk('stdout', chunk));
  child.stderr.on('data', (chunk: Buffer): void => onChunk('stderr', chunk));

  const output: ServerOutput = {
    captured: (): Record<string, string> | undefined => captured,
    closed,
    exit: (): string | undefined => exit,
    tail: (): string => tail
  };

  return output;
};

/** Spec §7 Supervisor step 4: wait patterns, then the probe, retried on the backoff until `timeout`; an exit first fails. */
const awaitReady = async (server: RunningServer, output: ServerOutput): Promise<LaunchOutcome> => {
  const { fact } = server;
  const timeout = fact.timeout ?? DEFAULT_SERVER_TIMEOUT_MS;
  const startedAt = Date.now();
  const deadline = startedAt + timeout;

  for (let attempt = 0; ; attempt += 1) {
    const exit = output.exit();

    if (exit !== undefined)
      return failedLaunch(`webServer "${fact.command}" exited with ${exit} before it was ready`, output.tail(), server);

    const env = output.captured();

    if (env !== undefined) {
      const isUp = await probeServer(fact);
      const ready: LaunchOutcome = { ok: true, env, server };

      if (isUp) return ready;
    }

    const now = Date.now();

    if (now >= deadline)
      return failedLaunch(`timed out after ${String(timeout)} ms waiting for webServer "${fact.command}"`, output.tail(), server);

    await Promise.race([sleep(nextProbeDelay(attempt)), output.closed]);
  }
};

/** Reuses a server that already answers (never stopped later); otherwise spawns `command` in the config dir and waits for it. */
export const launchWebServer = async (
  fact: WebServerFact,
  configDir: string,
  env: Record<string, string>,
  log: Writable
): Promise<LaunchOutcome> => {
  const isUp = await probeServer(fact);

  if (isUp) {
    const reused: LaunchOutcome = { ok: true, env: {}, server: undefined };

    log.write(`[turbo-atomizer] reusing the running webServer of "${fact.command}"\n`);

    return reused;
  }

  const cwd = resolve(configDir, fact.cwd ?? '.');

  log.write(`[turbo-atomizer] starting webServer: ${fact.command}\n`);

  const child = spawnServer(fact.command, cwd, env);
  const server: RunningServer = { child, fact };
  const output = watchOutput(child, fact.wait, log);

  return awaitReady(server, output);
};
