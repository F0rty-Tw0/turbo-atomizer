import { describe, expect, it } from 'vitest';

import { checkPeerVersions } from './peer-versions.util.ts';

describe('FEATURE: peer versions', (): void => {
  describe('GIVEN versions inside the peer ranges', (): void => {
    it('WHEN turbo 2.11.7 and Playwright 1.64.0 are checked THEN there are no findings', (): void => {
      const findings = checkPeerVersions('2.11.7', '1.64.0');

      expect(findings).toEqual([]);
    });

    it('WHEN Playwright is exactly the minimum 1.56.0 THEN there are no findings', (): void => {
      const findings = checkPeerVersions('2.11.9', '1.56.0');

      expect(findings).toEqual([]);
    });
  });

  describe('GIVEN turbo above the tested range', (): void => {
    it('WHEN turbo 2.12.0 is checked THEN one turbo warning is returned', (): void => {
      const findings = checkPeerVersions('2.12.0', '1.64.0');

      expect(findings).toMatchObject([{ level: 'warning', peer: 'turbo', version: '2.12.0' }]);
    });

    it('WHEN turbo is a 2.12 prerelease THEN one turbo warning is returned', (): void => {
      const findings = checkPeerVersions('2.12.0-canary.3', '1.64.0');

      expect(findings).toMatchObject([{ level: 'warning', peer: 'turbo' }]);
    });

    it('WHEN turbo is 3.0.0 THEN the warning message names the tested range', (): void => {
      const [finding] = checkPeerVersions('3.0.0', '1.64.0');

      expect(finding?.message).toContain('>=2.11.7 <2.12.0');
    });
  });

  describe('GIVEN versions below the minimum', (): void => {
    it('WHEN Playwright 1.55.0 is checked THEN one Playwright error is returned', (): void => {
      const findings = checkPeerVersions('2.11.7', '1.55.0');

      expect(findings).toMatchObject([{ level: 'error', peer: '@playwright/test', version: '1.55.0' }]);
    });

    it('WHEN turbo 2.11.6 is checked THEN one turbo error is returned', (): void => {
      const findings = checkPeerVersions('2.11.6', '1.64.0');

      expect(findings).toMatchObject([{ level: 'error', peer: 'turbo' }]);
    });

    it('WHEN turbo 2.9.10 is checked THEN numeric order is used, not text order', (): void => {
      const findings = checkPeerVersions('2.9.10', '1.64.0');

      expect(findings).toMatchObject([{ level: 'error', peer: 'turbo' }]);
    });
  });

  describe('GIVEN a version that is not semver', (): void => {
    it('WHEN it is checked THEN an error naming the version is returned', (): void => {
      const findings = checkPeerVersions('latest', '1.64.0');

      expect(findings).toMatchObject([{ level: 'error', peer: 'turbo', version: 'latest' }]);
    });
  });
});
