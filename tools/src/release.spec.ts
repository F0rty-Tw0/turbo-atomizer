import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ReleaseScenario } from './test/common/release-scenario.type.ts';
import { createReleaseScenario } from './test/utils/release-scenario.spec.util.ts';

describe('FEATURE: release driver', (): void => {
  describe('GIVEN an unreleased turbo-atomizer at 0.0.0 and no release tags', (): void => {
    let scenario: ReleaseScenario;

    beforeEach((): void => {
      scenario = createReleaseScenario();
    });

    afterEach((): void => {
      scenario.dispose();
    });

    describe('WHEN a minor release is planned', (): void => {
      it('THEN it reports turbo-atomizer and next version 0.1.0', (): void => {
        const result = scenario.run('plan', 'minor');

        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout).toContain('Project: turbo-atomizer');
        expect(result.stdout).toContain('Next version: 0.1.0');
      });

      it('THEN the manifest version is unchanged', (): void => {
        scenario.run('plan', 'minor');

        const version = scenario.version();

        expect(version).toBe('0.0.0');
      });
    });

    describe('WHEN a minor release is prepared', (): void => {
      beforeEach((): void => {
        const result = scenario.run('prepare', 'minor');

        expect(result.status, result.stderr).toBe(0);
      });

      it('THEN the CHANGELOG ships the curated 0.1.0 entry under a dated heading', (): void => {
        const changelog = scenario.changelog();

        expect(changelog).toMatch(/^## 0\.1\.0 \(\d{4}-\d{2}-\d{2}\)\n\nFirst release\.\n/m);
      });

      it('THEN no commit subject is written into the CHANGELOG', (): void => {
        const changelog = scenario.changelog();

        expect(changelog).not.toContain('ship the scenario feature');
      });
    });

    it('WHEN the bump is not patch, minor or major THEN it fails with usage', (): void => {
      const result = scenario.run('plan', 'huge');

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('Expected patch, minor, or major.');
    });
  });
});
