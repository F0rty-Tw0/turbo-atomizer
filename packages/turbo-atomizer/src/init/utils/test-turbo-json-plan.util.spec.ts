import { describe, expect, it } from 'vitest';

import { planTestTurboJson } from './test-turbo-json-plan.util.ts';
import type { JsonEdit, TurboJsonContent, TurboJsonDoc } from '../../shared/turbo/common/turbo-json.type.ts';
import type { TurboJsonPlan } from '../common/init.type.ts';
import { TURBO_JSON_DOC_STUB } from '../test/stubs/init.stub.ts';

const GENERATED = '@acme/web-e2e-atoms';

const UMBRELLA_TASK = { dependsOn: ['e2e-ci--all'] };

const CORRECT_TASKS = { 'e2e-ci': UMBRELLA_TASK };

const EXTENDS_EDIT: JsonEdit = { path: ['extends'], value: ['//', GENERATED] };

describe('FEATURE: test package turbo.json plan', (): void => {
  it('GIVEN no turbo.json WHEN it is planned THEN it is created with extends and the umbrella task', (): void => {
    const content: TurboJsonContent = { extends: ['//', GENERATED], tasks: CORRECT_TASKS };
    const expected: TurboJsonPlan = { kind: 'create', content };

    const plan = planTestTurboJson(undefined, GENERATED, 'e2e-ci', false);

    expect(plan).toEqual(expected);
  });

  describe('GIVEN a turbo.json whose extends lacks the generated name', (): void => {
    it('WHEN the umbrella task is absent THEN the name is appended and the task is added', (): void => {
      const content: TurboJsonContent = { extends: ['//'] };
      const existing: TurboJsonDoc = { ...TURBO_JSON_DOC_STUB, content };
      const taskEdit: JsonEdit = { path: ['tasks', 'e2e-ci'], value: UMBRELLA_TASK };
      const edits = [EXTENDS_EDIT, taskEdit];
      const expected: TurboJsonPlan = { kind: 'edit', edits };

      const plan = planTestTurboJson(existing, GENERATED, 'e2e-ci', false);

      expect(plan).toEqual(expected);
    });

    it('WHEN the umbrella task is already correct THEN only the name is appended', (): void => {
      const content: TurboJsonContent = { extends: ['//'], tasks: CORRECT_TASKS };
      const existing: TurboJsonDoc = { ...TURBO_JSON_DOC_STUB, content };
      const edits = [EXTENDS_EDIT];
      const expected: TurboJsonPlan = { kind: 'edit', edits };

      const plan = planTestTurboJson(existing, GENERATED, 'e2e-ci', false);

      expect(plan).toEqual(expected);
    });

    it('WHEN extends is missing entirely THEN it is set to the root and the generated name', (): void => {
      const content: TurboJsonContent = { tasks: CORRECT_TASKS };
      const existing: TurboJsonDoc = { ...TURBO_JSON_DOC_STUB, content };
      const edits = [EXTENDS_EDIT];
      const expected: TurboJsonPlan = { kind: 'edit', edits };

      const plan = planTestTurboJson(existing, GENERATED, 'e2e-ci', false);

      expect(plan).toEqual(expected);
    });
  });

  it('GIVEN a turbo.json that already depends on the aggregate WHEN it is planned THEN it is unchanged', (): void => {
    const umbrellaTask = { dependsOn: ['^build', 'e2e-ci--all'] };
    const tasks = { 'e2e-ci': umbrellaTask };
    const content: TurboJsonContent = { extends: ['//', GENERATED], tasks };
    const existing: TurboJsonDoc = { ...TURBO_JSON_DOC_STUB, content };

    const plan = planTestTurboJson(existing, GENERATED, 'e2e-ci', false);

    expect(plan).toEqual({ kind: 'unchanged' });
  });

  describe('GIVEN an umbrella task with other content', (): void => {
    it('WHEN it is planned THEN the conflict carries the exact edit to make', (): void => {
      const umbrellaTask = { command: 'playwright test' };
      const tasks = { 'e2e-ci': umbrellaTask };
      const content: TurboJsonContent = { extends: ['//', GENERATED], tasks };
      const existing: TurboJsonDoc = { ...TURBO_JSON_DOC_STUB, content };
      const message =
        '/repo/apps/web-e2e/turbo.json defines task "e2e-ci" without depending on "e2e-ci--all"; ' +
        'change it to "e2e-ci": { "dependsOn": ["e2e-ci--all"] }.';

      const plan = planTestTurboJson(existing, GENERATED, 'e2e-ci', false);

      expect(plan).toEqual({ kind: 'conflict', message });
    });

    it('WHEN the task is not an object THEN it is a conflict too', (): void => {
      const tasks = { 'e2e-ci': 'oops' };
      const content: TurboJsonContent = { extends: ['//', GENERATED], tasks };
      const existing: TurboJsonDoc = { ...TURBO_JSON_DOC_STUB, content };

      const plan = planTestTurboJson(existing, GENERATED, 'e2e-ci', false);

      expect(plan.kind).toBe('conflict');
    });
  });

  it('GIVEN a package.json script named like the task WHEN it is planned THEN it is a conflict naming the script', (): void => {
    const message =
      'The test package\'s package.json has a script named "e2e-ci"; turbo would run it after the file tasks. ' +
      'Remove or rename the script.';

    const plan = planTestTurboJson(undefined, GENERATED, 'e2e-ci', true);

    expect(plan).toEqual({ kind: 'conflict', message });
  });
});
