import { join } from 'node:path';

import { loadAtomizerConfig } from '../../shared/config/domain-logic/atomizer-config.ts';
import { findWorkspaceRoot } from '../../shared/turbo/data-access/workspace-root.store.ts';
import { readPackageName } from '../../shared/workspace/data-access/package-name.store.ts';
import type { AffectedDeps } from '../common/affected.type.ts';
import { selectPackageTasks, toTurboRunArgs } from '../utils/affected-tasks.util.ts';

const failAffected = (message: string): number => {
  process.stderr.write(`turbo-atomizer affected: ${message}\n`);

  return 1;
};

/** Spec §6.6: runs the affected file tasks of one test package through `turbo run` and returns turbo's exit code. */
export const affectedPackage = async (packageDir: string, forwarded: string[], deps: AffectedDeps): Promise<number> => {
  const loaded = await loadAtomizerConfig(packageDir);
  const packageName = await readPackageName(packageDir);

  if (packageName === undefined) return failAffected(`${join(packageDir, 'package.json')} has no name`);

  const root = await findWorkspaceRoot(packageDir);
  const fullNames = await deps.queryAffectedTasks(root, loaded.config.task);
  const taskNames = selectPackageTasks(fullNames, packageName);

  if (taskNames.length === 0) {
    process.stdout.write(`no affected file tasks in ${packageName}\n`);

    return 0;
  }

  const args = toTurboRunArgs(taskNames, packageName, forwarded);

  return deps.runTurbo(root, args);
};
