import type { TurboJsonDoc } from '../../../shared/turbo/common/turbo-json.type.ts';
import type { InitReport, PeerVersions } from '../../common/init.type.ts';

export const PEER_VERSIONS_STUB: PeerVersions = {
  playwright: '1.64.0',
  turbo: '2.11.7'
};

export const TURBO_JSON_DOC_STUB: TurboJsonDoc = {
  path: '/repo/apps/web-e2e/turbo.json',
  content: {}
};

export const INIT_REPORT_STUB: InitReport = {
  changes: [],
  lockfile: 'pnpm-lock.yaml',
  nextSteps: [],
  packageDir: '/repo/apps/web-e2e',
  sync: undefined,
  warnings: []
};
