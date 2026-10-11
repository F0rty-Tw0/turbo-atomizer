import { createFixtureWorkspace } from './fixture-workspace.spec.util.ts';
import { runChecked } from './workspace-command.spec.util.ts';
import { TEST_PACKAGE_DIR } from '../common/fixture-workspace.const.ts';
import type { FixtureName, FixtureWorkspace, PackageManager } from '../common/fixture-workspace.type.ts';

/** Runs `turbo-atomizer init` and `sync` as a consumer would, then commits the result; throws with their output on failure. */
const initAndSync = async (workspace: FixtureWorkspace): Promise<void> => {
  await runChecked(workspace.root, `turbo-atomizer init --package ${TEST_PACKAGE_DIR}`);
  await runChecked(workspace.root, 'turbo-atomizer sync');
  await workspace.commit('init');
};

/**
 * A fixture workspace after init and sync, in a dir named after `label`; disposes it when setup fails, since vitest skips
 * the teardown of a failed hook.
 */
export const createSyncedWorkspace = async (
  name: FixtureName,
  pm: PackageManager,
  label: string = name
): Promise<FixtureWorkspace> => {
  const workspace = await createFixtureWorkspace(name, pm, label);

  try {
    await initAndSync(workspace);
  } catch (error) {
    await workspace.dispose();

    throw error;
  }

  return workspace;
};
