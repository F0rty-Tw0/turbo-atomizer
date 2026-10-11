import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { buildAtomTask } from './atom-task.util.ts';
import { renderAtomsTurboJson } from './atoms-turbo-json.util.ts';
import type { AtomizerConfig } from '../../shared/config/common/atomizer-config.type.ts';
import type { AtomTask, AtomTaskInput } from '../common/atom-task.type.ts';
import { ATOMIZER_CONFIG_STUB, ATOM_TASK_INPUT_STUB } from '../test/stubs/atom-task.stub.ts';
import { syncFixtureFile } from '../test/utils/sync-fixture.spec.util.ts';

const uncached = { patterns: ['**/*.live.spec.ts'] };
const exampleConfig: AtomizerConfig = { ...ATOMIZER_CONFIG_STUB, failOnFlaky: true, uncached };
const exampleInput: AtomTaskInput = { ...ATOM_TASK_INPUT_STUB, config: exampleConfig, needsBlob: true };

const exampleTasks = (configInFile: boolean): AtomTask[] => {
  const login: AtomTaskInput = { ...exampleInput, configInFile };
  const checkout: AtomTaskInput = { ...login, listLine: 'checkout.live.spec.ts', taskPath: 'tests/checkout.live.spec.ts' };

  return [buildAtomTask(login), buildAtomTask(checkout)];
};

const atomTaskAt = (taskPath: string): AtomTask => {
  const input: AtomTaskInput = { ...ATOM_TASK_INPUT_STUB, taskPath };

  return buildAtomTask(input);
};

const renderedSchema = z.object({ tasks: z.record(z.string(), z.record(z.string(), z.unknown())) });

const parsedTasks = (text: string): Record<string, Record<string, unknown>> => {
  const json: unknown = JSON.parse(text);

  return renderedSchema.parse(json).tasks;
};

describe('FEATURE: atoms turbo.json', () => {
  describe('GIVEN the spec §4 example', () => {
    it('WHEN the config lives in turbo-atomizer.json THEN the output equals the spec example byte for byte', async () => {
      const expected = await readFile(syncFixtureFile('spec-example', 'turbo.json'), 'utf8');

      const text = renderAtomsTurboJson(exampleTasks(true), 'e2e-ci');

      expect(text).toBe(expected);
    });

    it('WHEN the config lives in package.json THEN the output omits the config-file exclusion', async () => {
      const expected = await readFile(syncFixtureFile('package-json-config', 'turbo.json'), 'utf8');

      const text = renderAtomsTurboJson(exampleTasks(false), 'e2e-ci');

      expect(text).toBe(expected);
    });
  });

  describe('GIVEN no specs', () => {
    it('WHEN rendered THEN the aggregate task is the only task and has no dependsOn', () => {
      const text = renderAtomsTurboJson([], 'smoke');

      expect(parsedTasks(text)).toEqual({ 'smoke--all': {} });
    });
  });

  describe('GIVEN specs whose names sort differently by locale', () => {
    const tasks = [atomTaskAt('tests/b.spec.ts'), atomTaskAt('tests/B.spec.ts'), atomTaskAt('tests/a.spec.ts')];

    it('WHEN rendered THEN file tasks come first by code unit, then carriers, then the aggregate', () => {
      const names = [
        'e2e-ci--tests/B.spec.ts',
        'e2e-ci--tests/a.spec.ts',
        'e2e-ci--tests/b.spec.ts',
        'e2e-ci-src--tests/B.spec.ts',
        'e2e-ci-src--tests/a.spec.ts',
        'e2e-ci-src--tests/b.spec.ts',
        'e2e-ci--all'
      ];

      const text = renderAtomsTurboJson(tasks, 'e2e-ci');

      expect(Object.keys(parsedTasks(text))).toEqual(names);
    });

    it('WHEN rendered THEN the aggregate depends on the file tasks only, in code-unit order', () => {
      const dependsOn = ['e2e-ci--tests/B.spec.ts', 'e2e-ci--tests/a.spec.ts', 'e2e-ci--tests/b.spec.ts'];
      const aggregate = { dependsOn };

      const text = renderAtomsTurboJson(tasks, 'e2e-ci');

      expect(parsedTasks(text)).toMatchObject({ 'e2e-ci--all': aggregate });
    });
  });

  describe('GIVEN a file task with every key set', () => {
    it('WHEN rendered THEN its keys follow the generation order', () => {
      const config: AtomizerConfig = { ...exampleConfig, passThroughEnv: ['HOME'] };
      const input: AtomTaskInput = { ...exampleInput, config, taskPath: 'tests/checkout.live.spec.ts' };
      const keys = ['command', 'dependsOn', 'inputs', 'outputs', 'env', 'passThroughEnv', 'cache', 'tags'];

      const text = renderAtomsTurboJson([buildAtomTask(input)], 'e2e-ci');

      const fileTask = parsedTasks(text)['e2e-ci--tests/checkout.live.spec.ts'];

      expect(Object.keys(fileTask ?? {})).toEqual(keys);
    });
  });
});
