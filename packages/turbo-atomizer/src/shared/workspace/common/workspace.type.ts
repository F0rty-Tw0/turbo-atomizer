export type PackageManager = 'npm' | 'pnpm';

export type PeerName = '@playwright/test' | 'turbo';

export type PeerVersionLevel = 'error' | 'warning';

export type PeerVersionFinding = {
  readonly level: PeerVersionLevel;
  readonly peer: PeerName;
  readonly version: string;
  readonly message: string;
};
