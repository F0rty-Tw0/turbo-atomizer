import type { AtomizerEnv } from '../../../atomizer/common/atomizer.type.ts';
import type { PlaywrightWebServer } from '../../common/playwright.type.ts';

export const ATOMIZER_ENV_STUB: AtomizerEnv = {
  active: false,
  captureServerEnv: false,
  countFile: undefined,
  describe: false
};

export const PLAYWRIGHT_WEB_SERVER_STUB: PlaywrightWebServer = {
  command: 'pnpm start',
  url: 'http://localhost:3000'
};
