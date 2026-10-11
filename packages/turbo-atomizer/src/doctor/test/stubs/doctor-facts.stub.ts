import type { AtomizerMetadata, WebServerFact } from '../../../shared/atomizer/common/atomizer.type.ts';
import type { TurboJsonDoc } from '../../../shared/turbo/common/turbo-json.type.ts';
import type { PackageTasks } from '../../../shared/turbo/common/turbo-query.type.ts';
import type { DoctorFacts } from '../../common/doctor-facts.type.ts';

export const WEB_SERVER_STUB: WebServerFact = {
  command: 'npm run start',
  url: 'http://localhost:3000'
};

export const DOCTOR_METADATA_STUB: AtomizerMetadata = {
  reporters: [],
  setupProjects: [],
  snapshotDirs: [],
  snapshotPathTemplates: [],
  version: 1,
  webServers: []
};

export const WEB_PACKAGE_TASKS_STUB: PackageTasks = {
  name: 'web',
  dir: 'apps/web',
  tasks: ['build', 'start']
};

const umbrellaTask = { dependsOn: ['e2e-ci--all'] };

const tasks = { 'e2e-ci': umbrellaTask };

const testTurboJsonContent = {
  extends: ['//', 'web-e2e-atoms'],
  tasks
};

export const TEST_TURBO_JSON_STUB: TurboJsonDoc = {
  path: '/repo/apps/web-e2e/turbo.json',
  content: testTurboJsonContent
};

const versions = { turbo: '2.11.7', playwright: '1.64.0' };

/** A healthy package: every check passes. */
export const DOCTOR_FACTS_STUB: DoctorFacts = {
  packageDir: 'apps/web-e2e',
  task: 'e2e-ci',
  stale: undefined,
  rejectedSpecs: [],
  metadata: DOCTOR_METADATA_STUB,
  testTurboJson: TEST_TURBO_JSON_STUB,
  generatedName: 'web-e2e-atoms',
  taskCommandFlagSet: true,
  affectedFlagSet: true,
  versions,
  dependsOn: ['^build'],
  dependencyTasks: [WEB_PACKAGE_TASKS_STUB],
  outsideImports: [],
  extraInputs: []
};
