import { describe, expect, it } from 'vitest';

import { checkMetadata } from './doctor-metadata.util.ts';
import type { AtomizerMetadata, WebServerFact } from '../../shared/atomizer/common/atomizer.type.ts';
import { DOCTOR_METADATA_STUB, WEB_SERVER_STUB } from '../test/stubs/doctor-facts.stub.ts';

describe('FEATURE: doctor metadata checks', (): void => {
  describe('GIVEN metadata with nothing custom', (): void => {
    it('WHEN it is checked THEN there are no findings', (): void => {
      const findings = checkMetadata(DOCTOR_METADATA_STUB);

      expect(findings).toEqual([]);
    });
  });

  describe('GIVEN web servers', (): void => {
    it('WHEN a server has a url THEN there are no findings', (): void => {
      const metadata: AtomizerMetadata = { ...DOCTOR_METADATA_STUB, webServers: [WEB_SERVER_STUB] };

      const findings = checkMetadata(metadata);

      expect(findings).toEqual([]);
    });

    it('WHEN a server has only a port THEN there are no findings', (): void => {
      const server: WebServerFact = { command: 'npm run start', port: 3000 };
      const metadata: AtomizerMetadata = { ...DOCTOR_METADATA_STUB, webServers: [server] };

      const findings = checkMetadata(metadata);

      expect(findings).toEqual([]);
    });

    it('WHEN a server has neither url nor port THEN a server-unshareable error names its command', (): void => {
      const server: WebServerFact = { command: 'npm run worker' };
      const metadata: AtomizerMetadata = { ...DOCTOR_METADATA_STUB, webServers: [WEB_SERVER_STUB, server] };

      const findings = checkMetadata(metadata);

      expect(findings).toMatchObject([{ level: 'error', code: 'server-unshareable' }]);
      expect(findings[0]?.message).toContain('npm run worker');
    });
  });

  describe('GIVEN setup projects', (): void => {
    it('WHEN they are checked THEN a setup-projects warning names them', (): void => {
      const metadata: AtomizerMetadata = { ...DOCTOR_METADATA_STUB, setupProjects: ['setup'] };

      const findings = checkMetadata(metadata);

      expect(findings).toMatchObject([{ level: 'warning', code: 'setup-projects' }]);
      expect(findings[0]?.message).toContain('setup');
    });
  });

  describe('GIVEN snapshot settings', (): void => {
    it('WHEN every project keeps the defaults THEN there are no findings', (): void => {
      const metadata: AtomizerMetadata = { ...DOCTOR_METADATA_STUB, snapshotDirs: [null], snapshotPathTemplates: [null] };

      const findings = checkMetadata(metadata);

      expect(findings).toEqual([]);
    });

    it('WHEN a project sets snapshotDir THEN a custom-snapshot-path warning is returned', (): void => {
      const metadata: AtomizerMetadata = { ...DOCTOR_METADATA_STUB, snapshotDirs: [null, 'snaps'] };

      const findings = checkMetadata(metadata);

      expect(findings).toMatchObject([{ level: 'warning', code: 'custom-snapshot-path' }]);
    });

    it('WHEN a project sets snapshotPathTemplate THEN a custom-snapshot-path warning is returned', (): void => {
      const metadata: AtomizerMetadata = { ...DOCTOR_METADATA_STUB, snapshotPathTemplates: ['{testDir}/__snapshots__/{arg}{ext}'] };

      const findings = checkMetadata(metadata);

      expect(findings).toMatchObject([{ level: 'warning', code: 'custom-snapshot-path' }]);
    });
  });

  describe('GIVEN configured reporters', (): void => {
    it('WHEN all are built in THEN there are no findings', (): void => {
      const reporters: [string, unknown][] = [
        ['html', {}],
        ['list', undefined]
      ];
      const metadata: AtomizerMetadata = { ...DOCTOR_METADATA_STUB, reporters };

      const findings = checkMetadata(metadata);

      expect(findings).toEqual([]);
    });

    it('WHEN one is a custom reporter THEN a custom-reporter warning names it', (): void => {
      const reporters: [string, unknown][] = [
        ['html', {}],
        ['./my-reporter.ts', {}]
      ];
      const metadata: AtomizerMetadata = { ...DOCTOR_METADATA_STUB, reporters };

      const findings = checkMetadata(metadata);

      expect(findings).toMatchObject([{ level: 'warning', code: 'custom-reporter' }]);
      expect(findings[0]?.message).toContain('./my-reporter.ts');
    });
  });
});
