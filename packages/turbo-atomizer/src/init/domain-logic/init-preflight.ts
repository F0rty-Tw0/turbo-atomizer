import { existsSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

import type { LoadedAtomizerConfig } from '../../shared/config/common/atomizer-config.type.ts';
import { findPlaywrightConfig } from '../../shared/config/data-access/atomizer-config.store.ts';
import { loadAtomizerConfig } from '../../shared/config/domain-logic/atomizer-config.ts';
import { readTurboJson } from '../../shared/turbo/data-access/turbo-json.store.ts';
import { findWorkspaceRoot } from '../../shared/turbo/data-access/workspace-root.store.ts';
import { PeerVersionException } from '../../shared/workspace/common/peer-version.exception.ts';
import { PNPM_WORKSPACE_FILE } from '../../shared/workspace/common/workspace.const.ts';
import type { PackageManager, PeerVersionFinding } from '../../shared/workspace/common/workspace.type.ts';
import { detectPackageManager } from '../../shared/workspace/data-access/package-manager.store.ts';
import { readPackageName } from '../../shared/workspace/data-access/package-name.store.ts';
import { hasPackageScript } from '../../shared/workspace/data-access/package-scripts.store.ts';
import { findExcludingGlob } from '../../shared/workspace/data-access/workspace-globs.store.ts';
import { checkPeerVersions } from '../../shared/workspace/utils/peer-versions.util.ts';
import { InitConflictException } from '../common/init-conflict.exception.ts';
import type { GeneratedPackage, InitOptions, InitPlan, PeerVersionsReader, TurboJsonPlan } from '../common/init.type.ts';
import { readGeneratedPackageOwner } from '../data-access/generated-package.store.ts';
import { generatedPackageFor } from '../utils/generated-package.util.ts';
import { planTestTurboJson } from '../utils/test-turbo-json-plan.util.ts';

type TestPackage = {
  readonly dir: string;
  readonly name: string;
};

const isError = (finding: PeerVersionFinding): boolean => finding.level === 'error';

/** Step 2: a peer below its minimum stops init before any write; the rest are warnings. */
const readPeerWarnings = async (root: string, packageDir: string, readVersions: PeerVersionsReader): Promise<string[]> => {
  const installed = await readVersions(root, packageDir);
  const findings = checkPeerVersions(installed.turbo, installed.playwright);
  const errors = findings.filter(isError);

  if (errors.length > 0) throw new PeerVersionException(errors);

  return findings.map((finding): string => finding.message);
};

const requireTestPackage = async (packageDir: string): Promise<TestPackage> => {
  const playwrightConfig = findPlaywrightConfig(packageDir);

  if (playwrightConfig === undefined) {
    throw new InitConflictException(packageDir, 'has no playwright.config.*; run init in the test package or pass --package <dir>.');
  }

  const name = await readPackageName(packageDir);

  if (name === undefined) {
    throw new InitConflictException(join(packageDir, 'package.json'), 'has no "name"; the generated package is named after it.');
  }

  const testPackage: TestPackage = { dir: packageDir, name };

  return testPackage;
};

/** The dir is written under the root and recorded as a workspace glob, so it must be relative and stay inside the root. */
const requireDirInsideRoot = (root: string, generated: GeneratedPackage): void => {
  const isAbsoluteDir = isAbsolute(generated.dir);
  const fromRoot = relative(root, resolve(root, generated.dir));
  const firstSegment = fromRoot.split(sep)[0];
  const isInvalid = isAbsoluteDir || firstSegment === '..';

  if (!isInvalid) return;

  throw new InitConflictException(
    root,
    `generated dir "${generated.dir}" must be a relative path inside the workspace root; pass --generated-dir such as tools/web-e2e-atoms.`
  );
};

/** Step 4: `--generated-dir`, else the configured `generatedPackage`, else `tools/<dir>-atoms`; the two given dirs must agree. */
const resolveGenerated = (root: string, testPackage: TestPackage, loaded: LoadedAtomizerConfig, generatedDir?: string): GeneratedPackage => {
  const configuredDir = loaded.source === 'default' ? undefined : loaded.config.generatedPackage;
  const generated = generatedPackageFor(testPackage.name, testPackage.dir, generatedDir ?? configuredDir);

  requireDirInsideRoot(root, generated);

  if (configuredDir === undefined) return generated;

  const configured = generatedPackageFor(testPackage.name, testPackage.dir, configuredDir);

  if (generated.dir === configured.dir) return generated;

  // The loaded config fills an unset generatedPackage with the derived default, so a match means it may not be set.
  const defaultDir = generatedPackageFor(testPackage.name, testPackage.dir).dir;
  const setting = configured.dir === defaultDir ? 'generatedPackage defaults to' : 'the atomizer config sets generatedPackage';

  throw new InitConflictException(
    testPackage.dir,
    `${setting} "${configured.dir}" but --generated-dir is "${generated.dir}"; drop --generated-dir or set generatedPackage in the config.`
  );
};

/** The rule `writeGeneratedPackage` applies, checked here so it fails before the first write: an existing dir must be the generated package. */
const requireOwnGeneratedDir = async (root: string, generated: GeneratedPackage): Promise<void> => {
  const dir = join(root, generated.dir);
  const dirExists = existsSync(dir);

  if (!dirExists) return;

  const owner = await readGeneratedPackageOwner(dir);

  if (owner === generated.name) return;

  const found = owner ?? 'no package.json';

  throw new InitConflictException(
    dir,
    `holds ${found}, not the generated package ${generated.name}; pass --generated-dir to choose another dir.`
  );
};

/** Step 6 would add the dir after the `!` glob, and the generated package would silently stay out of the workspace. */
const requireUnexcludedGeneratedDir = async (root: string, pm: PackageManager, generated: GeneratedPackage): Promise<void> => {
  const excluding = await findExcludingGlob(root, pm, generated.dir);

  if (excluding === undefined) return;

  const globsFile = pm === 'pnpm' ? PNPM_WORKSPACE_FILE : 'package.json';

  throw new InitConflictException(
    join(root, globsFile),
    `excludes ${generated.dir} with "${excluding}", so the generated package would not be a workspace package; remove that glob or pass --generated-dir.`
  );
};

const planTurboJson = async (packageDir: string, generated: GeneratedPackage, task: string): Promise<TurboJsonPlan> => {
  const existing = await readTurboJson(packageDir);
  const hasScript = await hasPackageScript(packageDir, task);
  const plan = planTestTurboJson(existing, generated.name, task, hasScript);

  if (plan.kind === 'conflict') throw new InitConflictException(packageDir, plan.message);

  return plan;
};

/** Runs every init check that can fail before the first write (spec §6.1 steps 1, 2, 4, 6, 8), so a failure leaves the workspace untouched. */
export const planInit = async (options: InitOptions, readVersions: PeerVersionsReader): Promise<InitPlan> => {
  const packageDir = resolve(options.packageDir);
  const root = await findWorkspaceRoot(packageDir);
  const pm = detectPackageManager(root);
  const testPackage = await requireTestPackage(packageDir);
  const warnings = await readPeerWarnings(root, packageDir, readVersions);
  const loaded = await loadAtomizerConfig(packageDir);
  const generated = resolveGenerated(root, testPackage, loaded, options.generatedDir);

  await requireOwnGeneratedDir(root, generated);
  await requireUnexcludedGeneratedDir(root, pm, generated);

  const turboJsonPlan = await planTurboJson(packageDir, generated, loaded.config.task);
  const plan: InitPlan = {
    cliVersion: options.cliVersion,
    config: loaded.config,
    generated,
    packageDir,
    packageName: testPackage.name,
    pm,
    root,
    turboJsonPlan,
    warnings
  };

  return plan;
};
