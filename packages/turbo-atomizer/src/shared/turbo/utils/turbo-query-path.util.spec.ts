import { describe, expect, it } from 'vitest';

import { toPosixPath, toWorkspaceFiles } from './turbo-query-path.util.ts';

describe('FEATURE: turbo query paths', (): void => {
  describe('GIVEN paths turbo query printed on Windows', (): void => {
    it('WHEN a package path is converted THEN it is posix', (): void => {
      const path = toPosixPath('apps\\web');

      expect(path).toBe('apps/web');
    });

    it('WHEN file dependencies are converted THEN they are posix and node_modules files are dropped', (): void => {
      const paths = ['apps\\web-e2e\\support\\home.ts', 'node_modules\\.pnpm\\@playwright+test@1.64.0\\index.d.ts', 'shared\\x.ts'];

      const files = toWorkspaceFiles(paths);

      expect(files).toEqual(['apps/web-e2e/support/home.ts', 'shared/x.ts']);
    });
  });

  describe('GIVEN paths turbo query printed on Linux or macOS', (): void => {
    it('WHEN file dependencies are converted THEN posix paths stay as they are and node_modules files are dropped', (): void => {
      const paths = ['apps/web-e2e/support/home.ts', 'node_modules/@playwright/test/index.d.ts'];

      const files = toWorkspaceFiles(paths);

      expect(files).toEqual(['apps/web-e2e/support/home.ts']);
    });
  });
});
