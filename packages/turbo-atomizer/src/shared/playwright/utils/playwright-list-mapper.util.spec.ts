import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { toSpecListing, toStderrTail } from './playwright-list-mapper.util.ts';
import type { ListedSuite, PlaywrightListReport } from '../common/spec-listing.type.ts';
import { ATOMIZER_METADATA_STUB } from '../test/stubs/playwright.stub.ts';

const rootDir = join('/repo', 'apps/e2e/tests');

describe('FEATURE: Playwright list mapper', (): void => {
  describe('GIVEN a report whose tests sit in nested describe suites of several projects', (): void => {
    it('WHEN it is mapped THEN each file lists its distinct projects in first-seen order', (): void => {
      const chromium = { projectName: 'chromium' };
      const firefox = { projectName: 'firefox' };
      const topSpec = { tests: [chromium, firefox] };
      const nestedSpec = { tests: [firefox, chromium] };
      const nestedSuite: ListedSuite = { file: 'a.spec.ts', specs: [nestedSpec] };
      const nestedSuites = [nestedSuite];
      const fileSuite: ListedSuite = { file: 'a.spec.ts', specs: [topSpec], suites: nestedSuites };
      const config = { metadata: {}, rootDir };
      const report: PlaywrightListReport = { config, suites: [fileSuite] };
      const expectedFile = { absPath: join(rootDir, 'a.spec.ts'), projects: ['chromium', 'firefox'] };

      const listing = toSpecListing(report);

      expect(listing.files).toEqual([expectedFile]);
    });
  });

  describe('GIVEN a report with atomizer metadata', (): void => {
    it('WHEN it is mapped THEN the metadata and rootDir are kept', (): void => {
      const metadata = { 'turbo-atomizer': ATOMIZER_METADATA_STUB };
      const config = { metadata, rootDir };
      const report: PlaywrightListReport = { config, suites: [] };
      const expected = { files: [], metadata: ATOMIZER_METADATA_STUB, rootDir };

      const listing = toSpecListing(report);

      expect(listing).toEqual(expected);
    });
  });

  describe('GIVEN a report without atomizer metadata', (): void => {
    it('WHEN it is mapped THEN metadata is undefined', (): void => {
      const config = { metadata: {}, rootDir };
      const report: PlaywrightListReport = { config, suites: [] };

      const listing = toSpecListing(report);

      expect(listing.metadata).toBeUndefined();
    });
  });

  describe('GIVEN stderr output', (): void => {
    it('WHEN it is longer than the tail THEN only the last 20 lines are kept', (): void => {
      const lines = Array.from({ length: 30 }, (_, index): string => `line ${index}`);
      const expected = lines.slice(10).join('\n');

      const tail = toStderrTail(`${lines.join('\n')}\n`);

      expect(tail).toBe(expected);
    });

    it('WHEN it is shorter than the tail THEN it is kept whole without trailing whitespace', (): void => {
      const tail = toStderrTail('Error: boom\n\n');

      expect(tail).toBe('Error: boom');
    });
  });
});
