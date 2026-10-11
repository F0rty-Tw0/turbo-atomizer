import type { ReleaseClient } from 'nx/release';

export type ReleaseBump = 'patch' | 'minor' | 'major';

export type ReleaseCommand = 'plan' | 'prepare';

export type ReleaseChangelogOptions = Parameters<ReleaseClient['releaseChangelog']>[0];
