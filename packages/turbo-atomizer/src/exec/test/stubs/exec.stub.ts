import type { ExecArgs, SlugPaths } from '../../common/exec.type.ts';

export const SLUG_PATHS_STUB: SlugPaths = {
  dir: '/pkg/.atomizer/slug',
  testList: '/pkg/.atomizer/slug/test-list.txt',
  testResults: '/pkg/.atomizer/slug/test-results',
  blob: '/pkg/.atomizer/slug/blob.zip',
  html: '/pkg/.atomizer/slug/html',
  json: '/pkg/.atomizer/slug/report.json',
  junit: '/pkg/.atomizer/slug/junit.xml',
  count: '/pkg/.atomizer/slug/count.json'
};

export const EXEC_ARGS_STUB: ExecArgs = {
  taskPath: 'tests/a.spec.ts',
  listLine: 'a.spec.ts',
  needsBlob: false,
  configFile: 'playwright.config.ts',
  playwrightArgs: ['--config=playwright.config.ts'],
  forwardedReporters: [],
  hasFilter: false
};
