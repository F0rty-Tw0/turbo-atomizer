import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import type { BuildPackageContext } from './common/build-package.type.ts';

export const emitPackageDeclarations = (context: BuildPackageContext): void => {
  const tscPath = join(context.workspaceRoot, 'node_modules/typescript7/bin/tsc');
  const configPath = join(context.packageRoot, 'tsconfig.declarations.json');
  const args = [tscPath, '-p', configPath, '--outDir', context.outputRoot];
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });

  if (result.status !== 0) throw new Error(`Declaration emit failed for ${configPath}`);
};
