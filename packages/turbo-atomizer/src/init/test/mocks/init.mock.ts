import { vi } from 'vitest';

import type { InitDeps, InstallRunner, PeerVersionsReader } from '../../common/init.type.ts';
import { PEER_VERSIONS_STUB } from '../stubs/init.stub.ts';

export const initDepsMock = (): InitDeps => {
  const install = vi.fn<InstallRunner>().mockResolvedValue(undefined);
  const versions = vi.fn<PeerVersionsReader>().mockResolvedValue(PEER_VERSIONS_STUB);
  const deps: InitDeps = { install, versions };

  return deps;
};
