import { PLAYWRIGHT_MIN_VERSION, TURBO_MIN_VERSION, TURBO_UNTESTED_VERSION } from '../common/workspace.const.ts';
import type { PeerName, PeerVersionFinding, PeerVersionLevel } from '../common/workspace.type.ts';

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)/;

const versionParts = (version: string): number[] | undefined => {
  const match = VERSION_PATTERN.exec(version);

  if (match === null) return undefined;

  const parts = match.slice(1).map(Number);

  return parts;
};

const compareParts = (left: number[], right: number[]): number => {
  for (const [index, part] of left.entries()) {
    const difference = part - (right[index] ?? 0);

    if (difference !== 0) return difference;
  }

  return 0;
};

const finding = (peer: PeerName, version: string, message: string, level: PeerVersionLevel): PeerVersionFinding => {
  const result: PeerVersionFinding = { level, peer, version, message };

  return result;
};

const turboFindings = (version: string, parts: number[]): PeerVersionFinding[] => {
  const minimum = versionParts(TURBO_MIN_VERSION) ?? [];
  const untested = versionParts(TURBO_UNTESTED_VERSION) ?? [];
  const range = `>=${TURBO_MIN_VERSION} <${TURBO_UNTESTED_VERSION}`;
  const minimumOrder = compareParts(parts, minimum);
  const untestedOrder = compareParts(parts, untested);
  const isBelowMinimum = minimumOrder < 0;
  const isUntested = untestedOrder >= 0;

  if (isBelowMinimum)
    return [finding('turbo', version, `turbo ${version} is below the minimum ${TURBO_MIN_VERSION}; upgrade turbo.`, 'error')];

  if (isUntested) {
    return [
      finding(
        'turbo',
        version,
        `turbo ${version} is outside the tested range ${range}; turbo-atomizer may not work with it.`,
        'warning'
      )
    ];
  }

  return [];
};

const playwrightFindings = (version: string, parts: number[]): PeerVersionFinding[] => {
  const minimum = versionParts(PLAYWRIGHT_MIN_VERSION) ?? [];
  const minimumOrder = compareParts(parts, minimum);
  const isBelowMinimum = minimumOrder < 0;

  if (!isBelowMinimum) return [];

  const message = `@playwright/test ${version} is below the minimum ${PLAYWRIGHT_MIN_VERSION}; upgrade @playwright/test.`;

  return [finding('@playwright/test', version, message, 'error')];
};

const peerFindings = (peer: PeerName, version: string): PeerVersionFinding[] => {
  const parts = versionParts(version);

  if (parts === undefined) return [finding(peer, version, `${peer} version "${version}" is not a semver version.`, 'error')];

  if (peer === 'turbo') return turboFindings(version, parts);

  return playwrightFindings(version, parts);
};

/** Checks the installed turbo and Playwright versions against the peer ranges (init step 2, doctor). */
export const checkPeerVersions = (turbo: string, playwright: string): PeerVersionFinding[] => {
  const turboResults = peerFindings('turbo', turbo);
  const playwrightResults = peerFindings('@playwright/test', playwright);

  return [...turboResults, ...playwrightResults];
};
