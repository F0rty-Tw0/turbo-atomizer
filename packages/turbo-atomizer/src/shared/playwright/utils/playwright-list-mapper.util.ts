import { resolve } from 'node:path';

import type { ListedSuite, PlaywrightListReport, SpecFile, SpecListing } from '../common/spec-listing.type.ts';

const STDERR_TAIL_LINES = 20;

const collectProjects = (suite: ListedSuite, projects: Set<string>): void => {
  const nestedSuites = suite.suites ?? [];

  for (const spec of suite.specs) {
    for (const test of spec.tests) projects.add(test.projectName);
  }

  for (const nested of nestedSuites) collectProjects(nested, projects);
};

const toSpecFile = (rootDir: string, suite: ListedSuite): SpecFile => {
  const projects = new Set<string>();

  collectProjects(suite, projects);

  const absPath = resolve(rootDir, suite.file);
  const specFile: SpecFile = { absPath, projects: [...projects] };

  return specFile;
};

/** Maps a `--list --reporter=json` report to one entry per file-level suite; Playwright already merges projects per file. */
export const toSpecListing = (report: PlaywrightListReport): SpecListing => {
  const { metadata, rootDir } = report.config;
  const files = report.suites.map((suite): SpecFile => toSpecFile(rootDir, suite));
  const listing: SpecListing = { files, metadata: metadata['turbo-atomizer'], rootDir };

  return listing;
};

export const toStderrTail = (stderr: string): string => {
  const lines = stderr.trimEnd().split('\n');

  return lines.slice(-STDERR_TAIL_LINES).join('\n');
};
