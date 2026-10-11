import { describe, expect, it } from 'vitest';

import { hasSharedSnapshots, isSetupOnlyFile, needsBlobReporter } from './sync-metadata.util.ts';
import type { AtomizerMetadata } from '../../shared/atomizer/common/atomizer.type.ts';
import type { SpecFile } from '../../shared/playwright/common/spec-listing.type.ts';
import { ATOMIZER_METADATA_STUB } from '../test/stubs/atomizer-metadata.stub.ts';

describe('FEATURE: sync metadata facts', (): void => {
  describe('GIVEN the setup project "setup"', (): void => {
    const setupProjects = ['setup'];

    it('WHEN a file has only setup tests THEN it is setup-only', (): void => {
      const file: SpecFile = { absPath: '/r/tests/auth.setup.ts', projects: ['setup'] };

      const isSetupOnly = isSetupOnlyFile(file, setupProjects);

      expect(isSetupOnly).toBe(true);
    });

    it('WHEN a file also has tests in another project THEN it is not setup-only', (): void => {
      const file: SpecFile = { absPath: '/r/tests/a.spec.ts', projects: ['setup', 'main'] };

      const isSetupOnly = isSetupOnlyFile(file, setupProjects);

      expect(isSetupOnly).toBe(false);
    });
  });

  describe('GIVEN the reporters of a config', (): void => {
    it('WHEN none is a blob reporter THEN exec must add one', (): void => {
      const metadata: AtomizerMetadata = { ...ATOMIZER_METADATA_STUB, reporters: [['list', {}]] };

      const needsBlob = needsBlobReporter(metadata);

      expect(needsBlob).toBe(true);
    });

    it('WHEN one is a blob reporter THEN exec adds none', (): void => {
      const metadata: AtomizerMetadata = { ...ATOMIZER_METADATA_STUB, reporters: [['list', {}], ['blob', {}]] };

      const needsBlob = needsBlobReporter(metadata);

      expect(needsBlob).toBe(false);
    });
  });

  describe('GIVEN the snapshot settings of a config', (): void => {
    it('WHEN every template and dir is unset THEN snapshots are per spec', (): void => {
      const isShared = hasSharedSnapshots(ATOMIZER_METADATA_STUB);

      expect(isShared).toBe(false);
    });

    it('WHEN a project sets a snapshotPathTemplate THEN snapshots are shared', (): void => {
      const metadata: AtomizerMetadata = { ...ATOMIZER_METADATA_STUB, snapshotPathTemplates: [null, '{arg}{ext}'] };

      const isShared = hasSharedSnapshots(metadata);

      expect(isShared).toBe(true);
    });

    it('WHEN the config sets a snapshotDir THEN snapshots are shared', (): void => {
      const metadata: AtomizerMetadata = { ...ATOMIZER_METADATA_STUB, snapshotDirs: ['snaps', null] };

      const isShared = hasSharedSnapshots(metadata);

      expect(isShared).toBe(true);
    });
  });
});
