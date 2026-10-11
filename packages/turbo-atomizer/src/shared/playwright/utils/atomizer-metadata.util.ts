import type { PlaywrightTestConfig, PlaywrightTestProject, ReporterDescription } from '@playwright/test';

import { ATOMIZER_METADATA_VERSION } from '../../atomizer/common/atomizer.const.ts';
import type { AtomizerMetadata, RegexFact, WaitFact, WebServerFact } from '../../atomizer/common/atomizer.type.ts';
import type { PlaywrightWebServer } from '../common/playwright.type.ts';

type ReporterPair = [string, unknown];

type ReporterConfig = PlaywrightTestConfig['reporter'];

type ServerWait = PlaywrightWebServer['wait'];

type WebServerConfig = PlaywrightTestConfig['webServer'];

const toReporterPair = (reporter: ReporterDescription): ReporterPair => {
  const options: unknown = reporter.at(1) ?? {};
  const pair: ReporterPair = [reporter[0], options];

  return pair;
};

const toReporterPairs = (reporter: ReporterConfig, ciDefault: boolean): ReporterPair[] => {
  if (reporter === undefined) {
    const name = ciDefault ? 'dot' : 'list';
    const defaults: ReporterPair[] = [[name, {}]];

    return defaults;
  }

  if (typeof reporter === 'string') {
    const single: ReporterPair[] = [[reporter, {}]];

    return single;
  }

  return reporter.map(toReporterPair);
};

const toRegexFact = (pattern: RegExp | undefined): RegexFact | undefined => {
  if (pattern === undefined) return undefined;

  const fact: RegexFact = { flags: pattern.flags, source: pattern.source };

  return fact;
};

const toWaitFact = (wait: ServerWait): WaitFact | undefined => {
  if (wait === undefined) return undefined;

  const stderr = toRegexFact(wait.stderr);
  const stdout = toRegexFact(wait.stdout);
  const fact: WaitFact = { stderr, stdout };

  return fact;
};

const toWebServerFact = (server: PlaywrightWebServer): WebServerFact => {
  const wait = toWaitFact(server.wait);
  const fact: WebServerFact = {
    command: server.command,
    cwd: server.cwd,
    env: server.env,
    gracefulShutdown: server.gracefulShutdown,
    ignoreHTTPSErrors: server.ignoreHTTPSErrors,
    port: server.port,
    timeout: server.timeout,
    url: server.url,
    wait
  };

  return fact;
};

const toWebServerFacts = (webServer: WebServerConfig): WebServerFact[] => {
  if (webServer === undefined) return [];

  if (Array.isArray(webServer)) return webServer.map(toWebServerFact);

  const fact = toWebServerFact(webServer);

  return [fact];
};

const referencedProjects = (project: PlaywrightTestProject): string[] => {
  const dependencies = project.dependencies ?? [];

  if (project.teardown === undefined) return dependencies;

  return [...dependencies, project.teardown];
};

const toSetupProjects = (projects: PlaywrightTestProject[]): string[] => {
  const names = new Set(projects.flatMap(referencedProjects));

  const uniqueNames = [...names];

  return uniqueNames.sort();
};

const snapshotDirOf = (project: PlaywrightTestProject): string | null => project.snapshotDir ?? null;

const snapshotPathTemplateOf = (project: PlaywrightTestProject): string | null => project.snapshotPathTemplate ?? null;

export const describeConfig = (
  config: PlaywrightTestConfig,
  ciDefault: boolean,
  serverEnv?: Record<string, string>
): AtomizerMetadata => {
  const projects = config.projects ?? [];
  const projectSnapshotDirs = projects.map(snapshotDirOf);
  const projectSnapshotPathTemplates = projects.map(snapshotPathTemplateOf);
  const snapshotDirs = [config.snapshotDir ?? null, ...projectSnapshotDirs];
  const snapshotPathTemplates = [config.snapshotPathTemplate ?? null, ...projectSnapshotPathTemplates];
  const metadata: AtomizerMetadata = {
    reporters: toReporterPairs(config.reporter, ciDefault),
    setupProjects: toSetupProjects(projects),
    snapshotDirs,
    snapshotPathTemplates,
    version: ATOMIZER_METADATA_VERSION,
    webServers: toWebServerFacts(config.webServer)
  };

  if (serverEnv === undefined) return metadata;

  const withServerEnv: AtomizerMetadata = { ...metadata, serverEnv };

  return withServerEnv;
};
