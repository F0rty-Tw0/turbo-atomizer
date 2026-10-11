import { describe, expect, it } from 'vitest';

import { checkCoverage } from './doctor-coverage.util.ts';
import type { AtomizerMetadata } from '../../shared/atomizer/common/atomizer.type.ts';
import type { PackageTasks } from '../../shared/turbo/common/turbo-query.type.ts';
import type { DoctorFacts, OutsideImport } from '../common/doctor-facts.type.ts';
import { DOCTOR_FACTS_STUB, DOCTOR_METADATA_STUB, WEB_PACKAGE_TASKS_STUB, WEB_SERVER_STUB } from '../test/stubs/doctor-facts.stub.ts';

const serverMetadata: AtomizerMetadata = { ...DOCTOR_METADATA_STUB, webServers: [WEB_SERVER_STUB] };

const serverFacts: DoctorFacts = { ...DOCTOR_FACTS_STUB, metadata: serverMetadata };

const sharedImport: OutsideImport = { spec: 'tests/a.spec.ts', file: 'shared/x.ts' };

const importFacts: DoctorFacts = { ...DOCTOR_FACTS_STUB, outsideImports: [sharedImport] };

describe('FEATURE: doctor coverage checks', (): void => {
  describe('GIVEN a web server and a dependency with a build task', (): void => {
    it('WHEN dependsOn is ^build THEN there are no findings', (): void => {
      const findings = checkCoverage(serverFacts);

      expect(findings).toEqual([]);
    });

    it('WHEN dependsOn names the dependency task THEN there are no findings', (): void => {
      const facts: DoctorFacts = { ...serverFacts, dependsOn: ['web#build'] };

      const findings = checkCoverage(facts);

      expect(findings).toEqual([]);
    });

    it('WHEN dependsOn names another package task THEN an app-dependency-missing error is returned', (): void => {
      const facts: DoctorFacts = { ...serverFacts, dependsOn: ['api#build'] };

      const findings = checkCoverage(facts);

      expect(findings).toMatchObject([{ level: 'error', code: 'app-dependency-missing' }]);
    });

    it('WHEN dependsOn is a task of the test package itself THEN an app-dependency-missing error is returned', (): void => {
      const facts: DoctorFacts = { ...serverFacts, dependsOn: ['build'] };

      const findings = checkCoverage(facts);

      expect(findings).toMatchObject([{ level: 'error', code: 'app-dependency-missing' }]);
    });
  });

  describe('GIVEN a web server and a dependency without a matching task', (): void => {
    const startOnly: PackageTasks = { ...WEB_PACKAGE_TASKS_STUB, tasks: ['start'] };
    const facts: DoctorFacts = { ...serverFacts, dependencyTasks: [startOnly] };

    it('WHEN the checks run THEN the error suggests a build task or extraInputs', (): void => {
      const findings = checkCoverage(facts);

      expect(findings).toMatchObject([{ level: 'error', code: 'app-dependency-missing' }]);
      expect(findings[0]?.message).toContain('extraInputs');
    });

    it('WHEN an extraInputs entry reaches outside the test package THEN there are no findings', (): void => {
      const covered: DoctorFacts = { ...facts, extraInputs: ['$TURBO_ROOT$/apps/web/src/**'] };

      const findings = checkCoverage(covered);

      expect(findings).toEqual([]);
    });

    it('WHEN a package-relative extraInputs entry reaches outside the test package THEN there are no findings', (): void => {
      const covered: DoctorFacts = { ...facts, extraInputs: ['../web/src/**'] };

      const findings = checkCoverage(covered);

      expect(findings).toEqual([]);
    });

    it('WHEN every extraInputs entry stays inside the test package THEN an app-dependency-missing error is returned', (): void => {
      const inside: DoctorFacts = { ...facts, extraInputs: ['README.md', '$TURBO_ROOT$/apps/web-e2e/fixtures/**'] };

      const findings = checkCoverage(inside);

      expect(findings).toMatchObject([{ code: 'app-dependency-missing' }]);
    });

    it('WHEN the only outside extraInputs entry is negated THEN an app-dependency-missing error is returned', (): void => {
      const negated: DoctorFacts = { ...facts, extraInputs: ['!$TURBO_ROOT$/apps/web/src/**'] };

      const findings = checkCoverage(negated);

      expect(findings).toMatchObject([{ code: 'app-dependency-missing' }]);
    });
  });

  describe('GIVEN no web server and no dependencies', (): void => {
    it('WHEN the checks run THEN there are no findings', (): void => {
      const facts: DoctorFacts = { ...DOCTOR_FACTS_STUB, dependencyTasks: [] };

      const findings = checkCoverage(facts);

      expect(findings).toEqual([]);
    });
  });

  describe('GIVEN no helper metadata', (): void => {
    it('WHEN the checks run THEN no app-dependency check is made', (): void => {
      const facts: DoctorFacts = { ...DOCTOR_FACTS_STUB, metadata: undefined, dependencyTasks: [] };

      const findings = checkCoverage(facts);

      expect(findings).toEqual([]);
    });
  });

  describe('GIVEN a spec importing a file outside the package', (): void => {
    it('WHEN nothing covers it THEN an outside-import error names the spec and the file', (): void => {
      const findings = checkCoverage(importFacts);

      expect(findings).toMatchObject([{ level: 'error', code: 'outside-import' }]);
      expect(findings[0]?.message).toMatch(/tests\/a\.spec\.ts.*shared\/x\.ts/);
    });

    it('WHEN the file is in a workspace dependency THEN there are no findings', (): void => {
      const appImport: OutsideImport = { spec: 'tests/a.spec.ts', file: 'apps/web/src/routes.ts' };
      const facts: DoctorFacts = { ...DOCTOR_FACTS_STUB, outsideImports: [appImport] };

      const findings = checkCoverage(facts);

      expect(findings).toEqual([]);
    });

    it('WHEN the file is in a workspace dependency without a task matched by dependsOn THEN an outside-import error is returned', (): void => {
      const appImport: OutsideImport = { spec: 'tests/a.spec.ts', file: 'apps/web/src/routes.ts' };
      const startOnly: PackageTasks = { ...WEB_PACKAGE_TASKS_STUB, tasks: ['start'] };
      const facts: DoctorFacts = { ...DOCTOR_FACTS_STUB, outsideImports: [appImport], dependencyTasks: [startOnly] };

      const findings = checkCoverage(facts);

      expect(findings).toMatchObject([{ code: 'outside-import' }]);
    });

    it('WHEN the file only shares a prefix with a dependency dir THEN an outside-import error is returned', (): void => {
      const lookalikeImport: OutsideImport = { spec: 'tests/a.spec.ts', file: 'apps/web-shared/x.ts' };
      const facts: DoctorFacts = { ...DOCTOR_FACTS_STUB, outsideImports: [lookalikeImport] };

      const findings = checkCoverage(facts);

      expect(findings).toMatchObject([{ code: 'outside-import' }]);
    });

    it('WHEN a $TURBO_ROOT$ extraInputs glob covers it THEN there are no findings', (): void => {
      const facts: DoctorFacts = { ...importFacts, extraInputs: ['$TURBO_ROOT$/shared/**'] };

      const findings = checkCoverage(facts);

      expect(findings).toEqual([]);
    });

    it('WHEN a package-relative extraInputs glob covers it THEN there are no findings', (): void => {
      const facts: DoctorFacts = { ...importFacts, extraInputs: ['../../shared/**'] };

      const findings = checkCoverage(facts);

      expect(findings).toEqual([]);
    });

    it('WHEN only a negated extraInputs glob matches it THEN an outside-import error is returned', (): void => {
      const facts: DoctorFacts = { ...importFacts, extraInputs: ['!$TURBO_ROOT$/shared/**'] };

      const findings = checkCoverage(facts);

      expect(findings).toMatchObject([{ code: 'outside-import' }]);
    });

    it('WHEN an extraInputs glob covers it but a negated entry excludes it THEN an outside-import error is returned', (): void => {
      const facts: DoctorFacts = { ...importFacts, extraInputs: ['$TURBO_ROOT$/shared/**', '!$TURBO_ROOT$/shared/x.ts'] };

      const findings = checkCoverage(facts);

      expect(findings).toMatchObject([{ code: 'outside-import' }]);
    });

    it('WHEN a negated entry excludes only another file THEN there are no findings', (): void => {
      const facts: DoctorFacts = { ...importFacts, extraInputs: ['$TURBO_ROOT$/shared/**', '!../../shared/y.ts'] };

      const findings = checkCoverage(facts);

      expect(findings).toEqual([]);
    });
  });
});
