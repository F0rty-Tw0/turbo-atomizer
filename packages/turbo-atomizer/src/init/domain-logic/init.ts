import { relative } from 'node:path';

import { planInit } from './init-preflight.ts';
import { MERGE_CONFIG_FILE } from '../../reports/common/reports.const.ts';
import { ATOMIZER_CONFIG_FILE, ATOMIZER_OUTPUT_DIR } from '../../shared/atomizer/common/atomizer.const.ts';
import { writeAtomizerConfigFile } from '../../shared/config/data-access/atomizer-config.store.ts';
import { listSpecs } from '../../shared/playwright/data-access/playwright-list.process.ts';
import { getPlaywrightVersion } from '../../shared/playwright/data-access/playwright-version.path.ts';
import type { JsonEdit } from '../../shared/turbo/common/turbo-json.type.ts';
import { editTurboJson } from '../../shared/turbo/data-access/turbo-json.store.ts';
import { getTurboVersion } from '../../shared/turbo/data-access/turbo-version.path.ts';
import { NPM_LOCKFILE, PNPM_LOCKFILE } from '../../shared/workspace/common/workspace.const.ts';
import { ensureGitignoreLines } from '../../shared/workspace/data-access/gitignore.store.ts';
import { runInstall } from '../../shared/workspace/data-access/install.process.ts';
import { ensureRootDevDependency } from '../../shared/workspace/data-access/root-package-json.store.ts';
import { ensureWorkspaceGlob } from '../../shared/workspace/data-access/workspace-globs.store.ts';
import { syncPackage } from '../../sync/domain-logic/sync.ts';
import { InitConflictException } from '../common/init-conflict.exception.ts';
import type { InitDeps, InitOptions, InitPlan, InitReport, PeerVersions, TurboJsonPlan } from '../common/init.type.ts';
import { writeGeneratedPackage } from '../data-access/generated-package.store.ts';
import { initNextSteps } from '../utils/init-summary.util.ts';

type InitChange = {
  readonly changed: boolean;
  readonly label: string;
};

const CLI_PACKAGE = 'turbo-atomizer';

const GITIGNORE_LINES = [`${ATOMIZER_OUTPUT_DIR}/`, MERGE_CONFIG_FILE];

const experimentalTaskCommand: JsonEdit = { path: ['futureFlags', 'experimentalTaskCommand'], value: true };
const affectedUsingTaskInputs: JsonEdit = { path: ['futureFlags', 'affectedUsingTaskInputs'], value: true };
const FUTURE_FLAG_EDITS = [experimentalTaskCommand, affectedUsingTaskInputs];

const testTurboJsonEdits = (plan: TurboJsonPlan): JsonEdit[] => {
  switch (plan.kind) {
    case 'create': {
      const create: JsonEdit = { path: [], value: plan.content };

      return [create];
    }

    case 'edit':
      return plan.edits;

    case 'unchanged':
    case 'conflict':
      return [];
  }
};

const isChanged = (change: InitChange): boolean => change.changed;

/** Steps 3, 5–9 in spec order; each checks before it writes and reports whether it changed a file. */
const writeInitFiles = async (plan: InitPlan): Promise<string[]> => {
  const { generated, packageDir, pm, root } = plan;
  const packagePath = relative(root, packageDir).replaceAll('\\', '/');
  const generatedPath = `${root}/${generated.dir}`;
  const globsFile = pm === 'pnpm' ? 'pnpm-workspace.yaml' : 'package.json workspaces';
  const configWritten = await writeAtomizerConfigFile(packageDir, { generatedPackage: generated.dir });
  const packageWritten = await writeGeneratedPackage(generatedPath, generated.name, plan.config.task);
  const globAdded = await ensureWorkspaceGlob(root, pm, generated.dir);
  const flagsSet = await editTurboJson(root, FUTURE_FLAG_EDITS);
  const testTurboJsonWritten = await editTurboJson(packageDir, testTurboJsonEdits(plan.turboJsonPlan));
  const devDependencyAdded = await ensureRootDevDependency(root, CLI_PACKAGE, `^${plan.cliVersion}`);
  const gitignoreEdited = await ensureGitignoreLines(root, GITIGNORE_LINES);
  const changes: InitChange[] = [
    { changed: configWritten, label: `${packagePath}/${ATOMIZER_CONFIG_FILE}` },
    { changed: packageWritten, label: `${generated.dir}/ (generated package ${generated.name})` },
    { changed: globAdded, label: globsFile },
    { changed: flagsSet, label: 'root turbo.json futureFlags' },
    { changed: testTurboJsonWritten, label: `${packagePath}/turbo.json` },
    { changed: devDependencyAdded, label: `package.json devDependencies ${CLI_PACKAGE}` },
    { changed: gitignoreEdited, label: '.gitignore' }
  ];

  return changes.filter(isChanged).map((change): string => change.label);
};

/** Step 11: sync only when the Playwright config already carries the helper metadata; init never edits that config. */
const syncOrNextSteps = async (plan: InitPlan, base: InitReport): Promise<InitReport> => {
  const { config, packageDir } = plan;
  const listing = await listSpecs(packageDir, config.playwrightConfig, { metadataOnly: true });

  if (listing.metadata === undefined) {
    const nextSteps = initNextSteps(config.playwrightConfig, plan.packageName);
    const skipped: InitReport = { ...base, nextSteps };

    return skipped;
  }

  const sync = await syncPackage(packageDir, { check: false });
  const synced: InitReport = { ...base, sync };

  return synced;
};

/** Sets up one test package (spec §6.1); a re-run changes nothing and installs nothing. */
export const initPackage = async (options: InitOptions, deps: InitDeps): Promise<InitReport> => {
  const plan = await planInit(options, deps.versions);
  const changes = await writeInitFiles(plan);

  if (changes.length > 0) await deps.install(plan.root, plan.pm);

  const lockfile = plan.pm === 'pnpm' ? PNPM_LOCKFILE : NPM_LOCKFILE;
  const base: InitReport = {
    changes,
    lockfile,
    nextSteps: [],
    packageDir: plan.packageDir,
    sync: undefined,
    warnings: plan.warnings
  };

  return syncOrNextSteps(plan, base);
};

const readTurboVersion = async (root: string): Promise<string> => {
  try {
    return await getTurboVersion(root);
  } catch {
    throw new InitConflictException(root, 'cannot read turbo/package.json from the workspace root; install turbo there, then re-run init.');
  }
};

const readPeerVersions = async (root: string, packageDir: string): Promise<PeerVersions> => {
  const turbo = await readTurboVersion(root);
  const playwright = getPlaywrightVersion(packageDir);
  const versions: PeerVersions = { playwright, turbo };

  return versions;
};

const INIT_DEPS: InitDeps = { install: runInstall, versions: readPeerVersions };

/** `initPackage` with the real install and the versions resolved from the workspace root and the test package. */
export const runInit = async (options: InitOptions): Promise<InitReport> => initPackage(options, INIT_DEPS);
