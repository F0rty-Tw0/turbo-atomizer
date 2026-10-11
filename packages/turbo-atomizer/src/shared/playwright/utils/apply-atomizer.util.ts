import type { PlaywrightTestConfig } from '@playwright/test';

import { describeConfig } from './atomizer-metadata.util.ts';
import { ATOMIZER_METADATA_KEY } from '../../atomizer/common/atomizer.const.ts';
import type { AtomizerEnv } from '../../atomizer/common/atomizer.type.ts';
import type { PlaywrightWebServer } from '../common/playwright.type.ts';

type WebServerConfig = PlaywrightWebServer | PlaywrightWebServer[];

const reuseServer = (server: PlaywrightWebServer): PlaywrightWebServer => {
  const reused: PlaywrightWebServer = { ...server, reuseExistingServer: true };

  return reused;
};

const reuseServers = (webServer: WebServerConfig): WebServerConfig => {
  if (Array.isArray(webServer)) return webServer.map(reuseServer);

  return reuseServer(webServer);
};

const withReusedServers = <TConfig extends PlaywrightTestConfig>(config: TConfig): TConfig => {
  if (config.webServer === undefined) return config;

  const webServer = reuseServers(config.webServer);
  const reused: TConfig = { ...config, webServer };

  return reused;
};

const withDescription = <TConfig extends PlaywrightTestConfig>(
  config: TConfig,
  ciDefault: boolean,
  serverEnv: Record<string, string> | undefined
): TConfig => {
  const description = describeConfig(config, ciDefault, serverEnv);
  const metadata = { ...config.metadata, [ATOMIZER_METADATA_KEY]: description };
  const described: TConfig = { ...config, metadata };

  return described;
};

export const applyAtomizer = <TConfig extends PlaywrightTestConfig>(
  config: TConfig,
  env: AtomizerEnv,
  ciDefault: boolean,
  processEnv: Record<string, string>
): TConfig => {
  if (!env.active) return config;

  const reused = withReusedServers(config);

  if (!env.describe) return reused;

  const serverEnv = env.captureServerEnv ? processEnv : undefined;

  return withDescription(reused, ciDefault, serverEnv);
};
