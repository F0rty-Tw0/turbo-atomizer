import { describe, expect, it } from 'vitest';

import { toPosixPath, toWorkspaceFiles } from './turbo-query-path.util.ts';

const WINDOWS_SEPARATOR = '\\';

const POSIX_SEPARATOR = '/';

describe('FEATURE: turbo query paths', (): void => {
  describe('GIVEN paths turbo query printed on Windows', (): void => {
    it('WHEN a package path is converted THEN it is posix', (): void => {
      const path = toPosixPath('apps\\web', WINDOWS_SEPARATOR);

      expect(path).toBe('apps/web');
    });

    it('WHEN file dependencies are converted THEN they are posix and node_modules files are dropped', (): void => {
      const paths = ['apps\\web-e2e\\support\\home.ts', 'node_modules\\.pnpm\\@playwright+test@1.64.0\\index.d.ts', 'shared\\x.ts'];

      const files = toWorkspaceFiles(paths, WINDOWS_SEPARATOR);

      expect(files).toEqual(['apps/web-e2e/support/home.ts', 'shared/x.ts']);
    });
  });

  describe('GIVEN paths turbo query printed on Linux or macOS', (): void => {
    it('WHEN file dependencies are converted THEN posix paths stay as they are and node_modules files are dropped', (): void => {
      const paths = ['apps/web-e2e/support/home.ts', 'node_modules/@playwright/test/index.d.ts'];

      const files = toWorkspaceFiles(paths, POSIX_SEPARATOR);

      expect(files).toEqual(['apps/web-e2e/support/home.ts']);
    });

    it('WHEN a file name holds a backslash THEN it is kept, as it is a legal file name char there', (): void => {
      const files = toWorkspaceFiles(['apps/web-e2e/support/odd\\name.ts'], POSIX_SEPARATOR);

      expect(files).toEqual(['apps/web-e2e/support/odd\\name.ts']);
    });
  });
});
