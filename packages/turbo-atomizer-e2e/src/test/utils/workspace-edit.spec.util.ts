import { runChecked } from './workspace-command.spec.util.ts';
import type { FixtureWorkspace } from '../common/fixture-workspace.type.ts';

/** Replaces `from` with `to` in a workspace file; throws when `from` is absent, so a fixture change cannot make a case pass vacuously. */
export const replaceInWorkspace = async (workspace: FixtureWorkspace, path: string, from: string, to: string): Promise<void> => {
  const text = await workspace.read(path);
  const hasFrom = text.includes(from);

  if (!hasFrom) throw new Error(`${path} does not contain ${JSON.stringify(from)}:\n${text}`);

  await workspace.edit(path, text.replace(from, to));
};

/** Drops every uncommitted edit and every new untracked file, so the next case starts from the last commit. */
export const resetWorkspace = async (workspace: FixtureWorkspace): Promise<void> => {
  await runChecked(workspace.root, 'git checkout --quiet -- . && git clean -fdq');
};
