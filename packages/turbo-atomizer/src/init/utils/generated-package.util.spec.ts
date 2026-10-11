import { describe, expect, it } from 'vitest';

import { generatedPackageFiles, generatedPackageFor } from './generated-package.util.ts';

describe('FEATURE: generated package', (): void => {
  describe('GIVEN a scoped test package', (): void => {
    it('WHEN no dir override is given THEN the name keeps the scope and the dir is tools/<basename>-atoms', (): void => {
      const generated = generatedPackageFor('@acme/web-e2e', '/repo/apps/web-e2e');

      expect(generated).toEqual({ name: '@acme/web-e2e-atoms', dir: 'tools/web-e2e-atoms' });
    });

    it('WHEN a dir override is given THEN the override is the dir', (): void => {
      const generated = generatedPackageFor('@acme/web-e2e', '/repo/apps/web-e2e', 'generated/web');

      expect(generated).toEqual({ name: '@acme/web-e2e-atoms', dir: 'generated/web' });
    });

    it('WHEN the override has backslashes and a trailing slash THEN the dir is posix without the slash', (): void => {
      const generated = generatedPackageFor('@acme/web-e2e', '/repo/apps/web-e2e', 'generated\\web\\');

      expect(generated.dir).toBe('generated/web');
    });
  });

  it('GIVEN an unscoped test package WHEN it is derived THEN the name gains -atoms', (): void => {
    const generated = generatedPackageFor('checkout-e2e', '/repo/e2e/checkout');

    expect(generated).toEqual({ name: 'checkout-e2e-atoms', dir: 'tools/checkout-atoms' });
  });

  describe('GIVEN a generated package name and a task', (): void => {
    it('WHEN its files are built THEN package.json is private at 0.0.0', (): void => {
      const files = generatedPackageFiles('@acme/web-e2e-atoms', 'e2e-ci');

      expect(files.packageJson).toBe('{\n  "name": "@acme/web-e2e-atoms",\n  "private": true,\n  "version": "0.0.0"\n}\n');
    });

    it('WHEN its files are built THEN turbo.json holds the definitions tag and an empty aggregate task', (): void => {
      const files = generatedPackageFiles('@acme/web-e2e-atoms', 'e2e-ci');

      expect(files.turboJson).toBe(
        '{\n  "extends": [\n    "//"\n  ],\n  "tags": [\n    "atomizer:definitions"\n  ],\n  "tasks": {\n    "e2e-ci--all": {}\n  }\n}\n'
      );
    });
  });
});
