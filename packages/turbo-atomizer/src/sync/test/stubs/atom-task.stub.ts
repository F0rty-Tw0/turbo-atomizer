import { DEFAULT_SERVER_IDLE_MS } from '../../../shared/atomizer/common/atomizer.const.ts';
import type { AtomizerConfig } from '../../../shared/config/common/atomizer-config.type.ts';
import type { AtomTaskInput } from '../../common/atom-task.type.ts';

const server = { idleMs: DEFAULT_SERVER_IDLE_MS };
const uncached = { patterns: [] };

export const ATOMIZER_CONFIG_STUB: AtomizerConfig = {
  dependsOn: ['^build'],
  env: [],
  extraInputs: [],
  failOnFlaky: false,
  generatedPackage: 'tools/web-e2e-atoms',
  passThroughEnv: [],
  playwrightConfig: 'playwright.config.ts',
  server,
  snapshotGlobs: ['**/*-snapshots/**'],
  specGlobs: ['**/*.{spec,test}.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'],
  task: 'e2e-ci',
  uncached
};

export const ATOM_TASK_INPUT_STUB: AtomTaskInput = {
  config: ATOMIZER_CONFIG_STUB,
  configInFile: true,
  listLine: 'login.spec.ts',
  needsBlob: false,
  snapshotsShared: false,
  taskPath: 'tests/login.spec.ts'
};
