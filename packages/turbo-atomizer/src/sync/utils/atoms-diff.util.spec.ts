import { describe, expect, it } from 'vitest';

import { diffAtoms } from './atoms-diff.util.ts';
import type { AtomsDiff } from '../common/atoms-diff.type.ts';

const loginTask = { command: ['node', 'login'], tags: ['atomizer:e2e-ci'] };
const cartTask = { command: ['node', 'cart'], tags: ['atomizer:e2e-ci'] };
const loginCarrier = { command: ['node', '-e', '0'], inputs: ['tests/login.spec.ts'], tags: ['atomizer:carrier'] };
const allTask = { dependsOn: ['e2e-ci--tests/login.spec.ts'] };

const atomsText = (tasks: Record<string, unknown>): string => {
  const turboJson = { extends: ['//'], tags: ['atomizer:definitions'], tasks };

  return `${JSON.stringify(turboJson, null, 2)}\n`;
};

const noChange: AtomsDiff = { added: [], removed: [], changed: [] };

describe('FEATURE: atoms diff', () => {
  describe('GIVEN a generated file with one task', () => {
    const before = atomsText({
      'e2e-ci--tests/login.spec.ts': loginTask,
      'e2e-ci-src--tests/login.spec.ts': loginCarrier,
      'e2e-ci--all': allTask
    });

    it('WHEN a task is added THEN it is reported as added', () => {
      const after = atomsText({
        'e2e-ci--tests/cart.spec.ts': cartTask,
        'e2e-ci--tests/login.spec.ts': loginTask,
        'e2e-ci-src--tests/login.spec.ts': loginCarrier,
        'e2e-ci--all': allTask
      });

      const diff = diffAtoms(before, after, 'e2e-ci');

      expect(diff.added).toEqual(['e2e-ci--tests/cart.spec.ts']);
    });

    it('WHEN a task is removed THEN it is reported as removed', () => {
      const after = atomsText({ 'e2e-ci--all': {} });

      const diff = diffAtoms(before, after, 'e2e-ci');

      expect(diff.removed).toEqual(['e2e-ci--tests/login.spec.ts']);
    });

    it('WHEN a task body changes THEN it is reported as changed', () => {
      const changedLoginTask = { ...loginTask, cache: false };
      const after = atomsText({
        'e2e-ci--tests/login.spec.ts': changedLoginTask,
        'e2e-ci-src--tests/login.spec.ts': loginCarrier,
        'e2e-ci--all': allTask
      });

      const diff = diffAtoms(before, after, 'e2e-ci');

      expect(diff.changed).toEqual(['e2e-ci--tests/login.spec.ts']);
    });

    it('WHEN the same file is generated again THEN nothing is reported', () => {
      const diff = diffAtoms(before, before, 'e2e-ci');

      expect(diff).toEqual(noChange);
    });

    it('WHEN only the carrier and the aggregate change THEN nothing is reported', () => {
      const changedCarrier = { ...loginCarrier, inputs: ['tests/login.spec.ts', 'tests/login.spec.ts-snapshots/**'] };
      const after = atomsText({
        'e2e-ci--tests/login.spec.ts': loginTask,
        'e2e-ci-src--tests/login.spec.ts': changedCarrier,
        'e2e-ci--all': {}
      });

      const diff = diffAtoms(before, after, 'e2e-ci');

      expect(diff).toEqual(noChange);
    });

    it('WHEN a task of another group is added THEN nothing is reported', () => {
      const smokeTask = { ...cartTask, tags: ['atomizer:smoke'] };
      const after = atomsText({
        'e2e-ci--tests/login.spec.ts': loginTask,
        'e2e-ci-src--tests/login.spec.ts': loginCarrier,
        'smoke--tests/cart.spec.ts': smokeTask,
        'e2e-ci--all': allTask
      });

      const diff = diffAtoms(before, after, 'e2e-ci');

      expect(diff).toEqual(noChange);
    });
  });

  describe('GIVEN no previous generated file', () => {
    const after = atomsText({
      'e2e-ci--tests/login.spec.ts': loginTask,
      'e2e-ci-src--tests/login.spec.ts': loginCarrier,
      'e2e-ci--all': allTask
    });
    const allAdded: AtomsDiff = { added: ['e2e-ci--tests/login.spec.ts'], removed: [], changed: [] };

    it('WHEN before is missing THEN every file task is reported as added', () => {
      const diff = diffAtoms(undefined, after, 'e2e-ci');

      expect(diff).toEqual(allAdded);
    });

    it('WHEN before is empty THEN every file task is reported as added', () => {
      const diff = diffAtoms('', after, 'e2e-ci');

      expect(diff).toEqual(allAdded);
    });

    it('WHEN before is not a generated file THEN every file task is reported as added', () => {
      const diff = diffAtoms('{ "tasks": [', after, 'e2e-ci');

      expect(diff).toEqual(allAdded);
    });
  });
});
