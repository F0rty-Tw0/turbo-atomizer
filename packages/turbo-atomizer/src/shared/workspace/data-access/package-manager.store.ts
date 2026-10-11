import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { UnknownLockfileException } from '../common/unknown-lockfile.exception.ts';
import { NPM_LOCKFILE, PNPM_LOCKFILE, UNSUPPORTED_LOCKFILES } from '../common/workspace.const.ts';
import type { PackageManager } from '../common/workspace.type.ts';

/** Detects the package manager from the lockfile in the workspace root (init step 1). */
export const detectPackageManager = (root: string): PackageManager => {
  const hasPnpmLockfile = existsSync(join(root, PNPM_LOCKFILE));

  if (hasPnpmLockfile) return 'pnpm';

  const hasNpmLockfile = existsSync(join(root, NPM_LOCKFILE));

  if (hasNpmLockfile) return 'npm';

  const lockfile = UNSUPPORTED_LOCKFILES.find((name) => existsSync(join(root, name)));

  throw new UnknownLockfileException(root, lockfile);
};
