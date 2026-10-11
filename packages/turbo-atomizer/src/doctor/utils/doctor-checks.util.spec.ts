import { describe, expect, it } from 'vitest';

import { runDoctorChecks } from './doctor-checks.util.ts';
import type { AtomsDiff } from '../../sync/common/atoms-diff.type.ts';
import type { DoctorFacts } from '../common/doctor-facts.type.ts';
import { DOCTOR_FACTS_STUB, DOCTOR_METADATA_STUB, TEST_TURBO_JSON_STUB, WEB_SERVER_STUB } from '../test/stubs/doctor-facts.stub.ts';

describe('FEATURE: doctor checks', (): void => {
  describe('GIVEN a healthy package', (): void => {
    it('WHEN the checks run THEN there are no findings', (): void => {
      const findings = runDoctorChecks(DOCTOR_FACTS_STUB);

      expect(findings).toEqual([]);
    });
  });

  describe('GIVEN a sync diff', (): void => {
    it('WHEN a file task changed THEN a stale-generated error is returned', (): void => {
      const stale: AtomsDiff = { added: [], removed: [], changed: ['tests/a.spec.ts'] };
      const facts: DoctorFacts = { ...DOCTOR_FACTS_STUB, stale };

      const findings = runDoctorChecks(facts);

      expect(findings).toMatchObject([{ level: 'error', code: 'stale-generated' }]);
    });

    it('WHEN a file task changed THEN the error counts the diff', (): void => {
      const stale: AtomsDiff = { added: ['tests/b.spec.ts'], removed: [], changed: ['tests/a.spec.ts'] };
      const facts: DoctorFacts = { ...DOCTOR_FACTS_STUB, stale };

      const [finding] = runDoctorChecks(facts);

      expect(finding?.message).toContain('stale (1 added, 0 removed, 1 changed)');
    });

    it('WHEN only carriers or formatting changed THEN a stale-generated error says so instead of three zero counts', (): void => {
      const stale: AtomsDiff = { added: [], removed: [], changed: [] };
      const facts: DoctorFacts = { ...DOCTOR_FACTS_STUB, stale };

      const findings = runDoctorChecks(facts);

      expect(findings).toMatchObject([{ level: 'error', code: 'stale-generated' }]);
      expect(findings[0]?.message).toContain('stale (carriers or formatting only)');
    });
  });

  describe('GIVEN no helper metadata', (): void => {
    it('WHEN the checks run THEN only a helper-missing error is returned', (): void => {
      const facts: DoctorFacts = { ...DOCTOR_FACTS_STUB, metadata: undefined };

      const findings = runDoctorChecks(facts);

      expect(findings).toMatchObject([{ level: 'error', code: 'helper-missing' }]);
    });
  });

  describe('GIVEN a drifted test turbo.json', (): void => {
    it('WHEN the file is missing THEN a test-turbo-json-drift error is returned', (): void => {
      const facts: DoctorFacts = { ...DOCTOR_FACTS_STUB, testTurboJson: undefined };

      const findings = runDoctorChecks(facts);

      expect(findings).toMatchObject([{ level: 'error', code: 'test-turbo-json-drift' }]);
    });

    it('WHEN it no longer extends the generated package THEN the error names the generated package', (): void => {
      const content = { ...TEST_TURBO_JSON_STUB.content, extends: ['//'] };
      const testTurboJson = { ...TEST_TURBO_JSON_STUB, content };
      const facts: DoctorFacts = { ...DOCTOR_FACTS_STUB, testTurboJson };

      const [finding] = runDoctorChecks(facts);

      expect(finding).toMatchObject({ code: 'test-turbo-json-drift' });
      expect(finding?.message).toContain('web-e2e-atoms');
    });

    it('WHEN the task was renamed THEN the error names the aggregate task', (): void => {
      const facts: DoctorFacts = { ...DOCTOR_FACTS_STUB, task: 'e2e' };

      const [finding] = runDoctorChecks(facts);

      expect(finding).toMatchObject({ code: 'test-turbo-json-drift' });
      expect(finding?.message).toContain('e2e--all');
    });
  });

  describe('GIVEN a root turbo.json missing a future flag', (): void => {
    it('WHEN experimentalTaskCommand is missing THEN a root-flag-missing error is returned', (): void => {
      const facts: DoctorFacts = { ...DOCTOR_FACTS_STUB, taskCommandFlagSet: false };

      const findings = runDoctorChecks(facts);

      expect(findings).toMatchObject([{ level: 'error', code: 'root-flag-missing' }]);
    });

    it('WHEN experimentalTaskCommand is missing and turbo could not be queried THEN no coverage error is added', (): void => {
      const metadata = { ...DOCTOR_METADATA_STUB, webServers: [WEB_SERVER_STUB] };
      const facts: DoctorFacts = { ...DOCTOR_FACTS_STUB, taskCommandFlagSet: false, metadata, dependencyTasks: [] };

      const findings = runDoctorChecks(facts);

      expect(findings).toMatchObject([{ level: 'error', code: 'root-flag-missing' }]);
    });

    it('WHEN affectedUsingTaskInputs is missing THEN an affected-flag-missing warning is returned', (): void => {
      const facts: DoctorFacts = { ...DOCTOR_FACTS_STUB, affectedFlagSet: false };

      const findings = runDoctorChecks(facts);

      expect(findings).toMatchObject([{ level: 'warning', code: 'affected-flag-missing' }]);
    });
  });

  describe('GIVEN installed peer versions', (): void => {
    it('WHEN Playwright is below the minimum THEN a peer-version error is returned', (): void => {
      const versions = { turbo: '2.11.7', playwright: '1.55.0' };
      const facts: DoctorFacts = { ...DOCTOR_FACTS_STUB, versions };

      const findings = runDoctorChecks(facts);

      expect(findings).toMatchObject([{ level: 'error', code: 'peer-version' }]);
    });

    it('WHEN turbo is outside the tested range THEN a turbo-untested warning is returned', (): void => {
      const versions = { turbo: '2.12.0', playwright: '1.64.0' };
      const facts: DoctorFacts = { ...DOCTOR_FACTS_STUB, versions };

      const findings = runDoctorChecks(facts);

      expect(findings).toMatchObject([{ level: 'warning', code: 'turbo-untested' }]);
    });
  });

  describe('GIVEN a spec sync rejected', (): void => {
    it('WHEN the checks run THEN a spec-rejected error names the spec', (): void => {
      const facts: DoctorFacts = { ...DOCTOR_FACTS_STUB, rejectedSpecs: ['tests/a[1].spec.ts'] };

      const findings = runDoctorChecks(facts);

      expect(findings).toMatchObject([{ level: 'error', code: 'spec-rejected' }]);
      expect(findings[0]?.message).toContain('tests/a[1].spec.ts');
    });
  });

  describe('GIVEN helper metadata with a setup project', (): void => {
    it('WHEN the checks run THEN the metadata findings are included', (): void => {
      const metadata = { ...DOCTOR_METADATA_STUB, setupProjects: ['setup'] };
      const facts: DoctorFacts = { ...DOCTOR_FACTS_STUB, metadata };

      const findings = runDoctorChecks(facts);

      expect(findings).toMatchObject([{ level: 'warning', code: 'setup-projects' }]);
    });
  });

  describe('GIVEN a spec importing an uncovered file outside the package', (): void => {
    it('WHEN the checks run THEN the coverage findings are included', (): void => {
      const outsideImports = [{ spec: 'tests/a.spec.ts', file: 'shared/x.ts' }];
      const facts: DoctorFacts = { ...DOCTOR_FACTS_STUB, outsideImports };

      const findings = runDoctorChecks(facts);

      expect(findings).toMatchObject([{ level: 'error', code: 'outside-import' }]);
    });
  });
});
