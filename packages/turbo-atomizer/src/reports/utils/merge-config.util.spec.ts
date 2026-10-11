import { describe, expect, it } from 'vitest';

import { renderMergeConfig } from './merge-config.util.ts';
import { importDefaultExport } from '../test/utils/module-text.spec.util.ts';

describe('FEATURE: merge config', () => {
  describe('GIVEN blob and html reporters', () => {
    it('WHEN rendered THEN the module exports the html reporter with its options and no blob', async () => {
      const blobOptions = { outputDir: 'blobs' };
      const htmlOptions = { outputFolder: 'out' };
      const reporters: [string, unknown][] = [
        ['blob', blobOptions],
        ['html', htmlOptions]
      ];
      const htmlReporter = ['html', htmlOptions];
      const expected = { reporter: [htmlReporter], testDir: './tests' };

      const text = renderMergeConfig(reporters, './tests');

      await expect(importDefaultExport(text)).resolves.toEqual(expected);
    });
  });

  describe('GIVEN several reporters without blob', () => {
    it('WHEN rendered THEN all reporters are kept in order', async () => {
      const junitOptions = { outputFile: 'results/junit.xml', includeProjectInTestName: true };
      const reporters: [string, unknown][] = [
        ['list', {}],
        ['junit', junitOptions],
        ['./reporters/custom.ts', {}]
      ];
      const expected = { reporter: reporters, testDir: 'tests' };

      const text = renderMergeConfig(reporters, 'tests');

      await expect(importDefaultExport(text)).resolves.toEqual(expected);
    });
  });

  describe('GIVEN only a blob reporter', () => {
    it('WHEN rendered THEN the reporter list is empty', async () => {
      const reporters: [string, unknown][] = [['blob', {}]];
      const expected = { reporter: [], testDir: './tests' };

      const text = renderMergeConfig(reporters, './tests');

      await expect(importDefaultExport(text)).resolves.toEqual(expected);
    });
  });

  describe('GIVEN a testDir with backslashes and quotes', () => {
    it('WHEN rendered THEN the testDir survives verbatim', async () => {
      const testDir = String.raw`C:\work\it's "e2e"\tests`;
      const expected = { reporter: [], testDir };

      const text = renderMergeConfig([], testDir);

      await expect(importDefaultExport(text)).resolves.toEqual(expected);
    });
  });
});
