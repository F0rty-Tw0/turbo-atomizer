import { copyFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createWorkspace } from './fixture-workspace.spec.util.ts';
import { runChecked } from './workspace-command.spec.util.ts';
import { ATOMIZER_PACKAGE, INSTALL_COMMANDS } from '../common/fixture-workspace.const.ts';
import type { FixtureWorkspace, PackageManager } from '../common/fixture-workspace.type.ts';
import { rootManifestSchema } from '../common/turbo-summary.schema.ts';

const FILE_PROTOCOL = 'file:';

/** The packed tarball the root `package.json` installs `turbo-atomizer` from. */
const tarballOf = async (root: string): Promise<string> => {
  const text = await readFile(join(root, 'package.json'), 'utf8');
  const raw: unknown = JSON.parse(text);
  const manifest = rootManifestSchema.parse(raw);
  const spec = manifest.devDependencies[ATOMIZER_PACKAGE] ?? '';
  const isTarball = spec.startsWith(FILE_PROTOCOL);

  if (!isTarball) throw new Error(`${ATOMIZER_PACKAGE} is not installed from a tarball in ${root}`);

  return spec.slice(FILE_PROTOCOL.length);
};

/** Clones `source` into `root`, copies the git-ignored tarball across and installs, as a CI runner would. */
const prepareClone = async (root: string, source: string, pm: PackageManager): Promise<void> => {
  await runChecked(root, `git clone --quiet ${JSON.stringify(source)} .`);

  const tarball = await tarballOf(root);

  await copyFile(join(source, tarball), join(root, tarball));
  await runChecked(root, INSTALL_COMMANDS[pm]);
};

/** A fresh `git clone` of `source` with its own install; nothing git ignores (`.turbo`, `.atomizer`) comes along. */
export const cloneFixtureWorkspace = async (source: FixtureWorkspace, pm: PackageManager): Promise<FixtureWorkspace> => {
  const prepare = async (root: string): Promise<void> => prepareClone(root, source.root, pm);

  return createWorkspace('clone', prepare);
};
