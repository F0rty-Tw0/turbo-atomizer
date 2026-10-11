import type { AtomizerEnv, AtomizerMetadata } from '../../../atomizer/common/atomizer.type.ts';
import type { PlaywrightWebServer } from '../../common/playwright.type.ts';

export const ATOMIZER_ENV_STUB: AtomizerEnv = {
  active: false,
  args: undefined,
  captureServerEnv: false,
  countFile: undefined,
  describe: false
};

export const PLAYWRIGHT_WEB_SERVER_STUB: PlaywrightWebServer = {
  command: 'pnpm start',
  url: 'http://localhost:3000'
};

export const ATOMIZER_METADATA_STUB: AtomizerMetadata = {
  reporters: [],
  setupProjects: [],
  snapshotDirs: [],
  snapshotPathTemplates: [],
  version: 1,
  webServers: []
};
