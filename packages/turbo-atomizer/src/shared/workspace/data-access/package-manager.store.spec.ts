import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { detectPackageManager } from './package-manager.store.ts';
import { fixtureDirectory } from '../../../test/utils/fixture-copy.spec.util.ts';
import { UnknownLockfileException } from '../common/unknown-lockfile.exception.ts';
import type { PackageManager } from '../common/workspace.type.ts';

describe('FEATURE: package manager detection', (): void => {
  it('GIVEN a workspace with pnpm-lock.yaml WHEN it is detected THEN pnpm is returned', (): void => {
    const packageManager = detectPackageManager(fixtureDirectory('init-pnpm'));

    expect(packageManager).toBe('pnpm');
  });

  it('GIVEN a workspace with package-lock.json WHEN it is detected THEN npm is returned', (): void => {
    const packageManager = detectPackageManager(fixtureDirectory('init-npm'));

    expect(packageManager).toBe('npm');
  });

  describe('GIVEN a workspace with only yarn.lock', (): void => {
    const detecting = (): PackageManager => detectPackageManager(fixtureDirectory('init-yarn'));

    it('WHEN it is detected THEN it throws UnknownLockfileException', (): void => {
      expect(detecting).toThrow(UnknownLockfileException);
    });

    it('WHEN it is detected THEN the error names yarn.lock', (): void => {
      expect(detecting).toThrow('found yarn.lock');
    });
  });

  it('GIVEN a directory without any lockfile WHEN it is detected THEN the error says no lockfile', (): void => {
    const directory = join(fixtureDirectory('init-pnpm'), 'apps/web-e2e');
    const detecting = (): PackageManager => detectPackageManager(directory);

    expect(detecting).toThrow('found no lockfile');
  });
});
