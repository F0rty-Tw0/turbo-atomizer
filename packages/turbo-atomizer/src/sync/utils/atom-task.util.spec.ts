import { describe, expect, it } from 'vitest';

import { buildAtomTask } from './atom-task.util.ts';
import type { AtomizerConfig } from '../../shared/config/common/atomizer-config.type.ts';
import type { AtomTaskInput, TurboTask } from '../common/atom-task.type.ts';
import { ATOMIZER_CONFIG_STUB, ATOM_TASK_INPUT_STUB } from '../test/stubs/atom-task.stub.ts';

const SPEC_GLOB_EXCLUSION = '!**/*.{spec,test}.{ts,tsx,js,jsx,mts,cts,mjs,cjs}';

const inputWithConfig = (config: AtomizerConfig): AtomTaskInput => {
  const input: AtomTaskInput = { ...ATOM_TASK_INPUT_STUB, config };

  return input;
};

const patterns = ['**/*.live.spec.ts'];
const liveUncached = { patterns };
const committedLiveUncached = { commitEnv: 'GIT_SHA', patterns };
const LIVE_CONFIG: AtomizerConfig = { ...ATOMIZER_CONFIG_STUB, uncached: liveUncached };
const COMMITTED_LIVE_CONFIG: AtomizerConfig = { ...ATOMIZER_CONFIG_STUB, uncached: committedLiveUncached };
const LIVE_PATH = 'tests/checkout.live.spec.ts';
const LIVE_INPUT: AtomTaskInput = { ...ATOM_TASK_INPUT_STUB, config: LIVE_CONFIG, taskPath: LIVE_PATH };
const COMMITTED_LIVE_INPUT: AtomTaskInput = { ...ATOM_TASK_INPUT_STUB, config: COMMITTED_LIVE_CONFIG, taskPath: LIVE_PATH };

describe('FEATURE: atom task', () => {
  describe('GIVEN a cached spec with the default config', () => {
    describe('WHEN its task is built', () => {
      it('THEN the file task is named after the task path', () => {
        const { file } = buildAtomTask(ATOM_TASK_INPUT_STUB);

        expect(file.name).toBe('e2e-ci--tests/login.spec.ts');
      });

      it('THEN the command runs exec with the task path, the list line and the config file', () => {
        const command = [
          'node',
          '-e',
          "require('turbo-atomizer/exec')",
          'tests/login.spec.ts',
          'login.spec.ts',
          '--config=playwright.config.ts'
        ];

        const { file } = buildAtomTask(ATOM_TASK_INPUT_STUB);

        expect(file.definition.command).toEqual(command);
      });

      it('THEN the file task depends on the configured tasks and then its carrier', () => {
        const { file } = buildAtomTask(ATOM_TASK_INPUT_STUB);

        expect(file.definition.dependsOn).toEqual(['^build', 'e2e-ci-src--tests/login.spec.ts']);
      });

      it('THEN the inputs exclude every spec, every snapshot dir and the config file, never listing the own spec', () => {
        const inputs = ['$TURBO_DEFAULT$', SPEC_GLOB_EXCLUSION, '!**/*-snapshots/**', '!turbo-atomizer.json'];

        const { file } = buildAtomTask(ATOM_TASK_INPUT_STUB);

        expect(file.definition.inputs).toEqual(inputs);
      });

      it('THEN the outputs are the slug dir without its test-results', () => {
        const outputs = ['.atomizer/tests-login-spec-ts-6b6dc3/**', '!.atomizer/tests-login-spec-ts-6b6dc3/test-results/**'];

        const { file } = buildAtomTask(ATOM_TASK_INPUT_STUB);

        expect(file.definition.outputs).toEqual(outputs);
      });

      it('THEN the env hashes only TURBO_ATOMIZER_ARGS', () => {
        const { file } = buildAtomTask(ATOM_TASK_INPUT_STUB);

        expect(file.definition.env).toEqual(['TURBO_ATOMIZER_ARGS']);
      });

      it('THEN the file task stays cached and carries only the group tag', () => {
        const { file } = buildAtomTask(ATOM_TASK_INPUT_STUB);

        expect(file.definition.cache).toBe(true);
        expect(file.definition.tags).toEqual(['atomizer:e2e-ci']);
      });

      it('THEN the carrier hashes the own spec and its snapshots, with no other keys', () => {
        const definition = {
          command: ['node', '-e', '0'],
          inputs: ['tests/login.spec.ts', 'tests/login.spec.ts-snapshots/**'],
          tags: ['atomizer:carrier']
        };
        const carrier: TurboTask = { definition, name: 'e2e-ci-src--tests/login.spec.ts' };

        const atomTask = buildAtomTask(ATOM_TASK_INPUT_STUB);

        expect(atomTask.carrier).toEqual(carrier);
      });
    });
  });

  describe('GIVEN a config without a blob reporter and with failOnFlaky', () => {
    it('WHEN its task is built THEN the command adds the blob flag before the config and the flaky flag after it', () => {
      const config: AtomizerConfig = { ...ATOMIZER_CONFIG_STUB, failOnFlaky: true };
      const input: AtomTaskInput = { ...ATOM_TASK_INPUT_STUB, config, needsBlob: true };
      const flags = ['--atomizer-blob', '--config=playwright.config.ts', '--fail-on-flaky-tests'];

      const { file } = buildAtomTask(input);

      expect(file.definition.command?.slice(5)).toEqual(flags);
    });
  });

  describe('GIVEN a custom task name', () => {
    it('WHEN its task is built THEN the file task, its carrier and its tag use that name', () => {
      const config: AtomizerConfig = { ...ATOMIZER_CONFIG_STUB, task: 'smoke' };

      const { carrier, file } = buildAtomTask(inputWithConfig(config));

      expect(file.name).toBe('smoke--tests/login.spec.ts');
      expect(carrier.name).toBe('smoke-src--tests/login.spec.ts');
      expect(file.definition.tags).toEqual(['atomizer:smoke']);
    });
  });

  describe('GIVEN a live spec without commitEnv', () => {
    it('WHEN its task is built THEN the file task is uncached and tagged live', () => {
      const { file } = buildAtomTask(LIVE_INPUT);

      expect(file.definition.cache).toBe(false);
      expect(file.definition.tags).toEqual(['atomizer:e2e-ci', 'atomizer:live']);
    });

    it('WHEN its task is built THEN the carrier stays cached', () => {
      const { carrier } = buildAtomTask(LIVE_INPUT);

      expect(carrier.definition.cache).toBeUndefined();
    });

    it('WHEN a spec that misses the patterns is built THEN it stays cached and untagged', () => {
      const { file } = buildAtomTask(inputWithConfig(LIVE_CONFIG));

      expect(file.definition.cache).toBe(true);
      expect(file.definition.tags).toEqual(['atomizer:e2e-ci']);
    });
  });

  describe('GIVEN a live spec with commitEnv', () => {
    it('WHEN its task is built THEN commitEnv precedes TURBO_ATOMIZER_ARGS in env', () => {
      const { file } = buildAtomTask(COMMITTED_LIVE_INPUT);

      expect(file.definition.env).toEqual(['GIT_SHA', 'TURBO_ATOMIZER_ARGS']);
    });

    it('WHEN its task is built THEN it stays cached and still carries the live tag', () => {
      const { file } = buildAtomTask(COMMITTED_LIVE_INPUT);

      expect(file.definition.cache).toBe(true);
      expect(file.definition.tags).toEqual(['atomizer:e2e-ci', 'atomizer:live']);
    });
  });

  describe('GIVEN a cached spec with commitEnv configured', () => {
    it('WHEN its task is built THEN commitEnv is not hashed', () => {
      const { file } = buildAtomTask(inputWithConfig(COMMITTED_LIVE_CONFIG));

      expect(file.definition.env).toEqual(['TURBO_ATOMIZER_ARGS']);
    });
  });

  describe('GIVEN a config read from package.json', () => {
    it('WHEN its task is built THEN the inputs omit the config-file exclusion', () => {
      const input: AtomTaskInput = { ...ATOM_TASK_INPUT_STUB, configInFile: false };

      const { file } = buildAtomTask(input);

      expect(file.definition.inputs).toEqual(['$TURBO_DEFAULT$', SPEC_GLOB_EXCLUSION, '!**/*-snapshots/**']);
    });
  });

  describe('GIVEN shared snapshots', () => {
    const input: AtomTaskInput = { ...ATOM_TASK_INPUT_STUB, snapshotsShared: true };

    it('WHEN its task is built THEN the file task keeps snapshots as an input', () => {
      const { file } = buildAtomTask(input);

      expect(file.definition.inputs).toEqual(['$TURBO_DEFAULT$', SPEC_GLOB_EXCLUSION, '!turbo-atomizer.json']);
    });

    it('WHEN its task is built THEN the carrier hashes only the own spec', () => {
      const { carrier } = buildAtomTask(input);

      expect(carrier.definition.inputs).toEqual(['tests/login.spec.ts']);
    });
  });

  describe('GIVEN a config with env, passThroughEnv, extraInputs and dependsOn', () => {
    const config: AtomizerConfig = {
      ...ATOMIZER_CONFIG_STUB,
      dependsOn: ['^build', 'web#build'],
      env: ['BASE_URL'],
      extraInputs: ['$TURBO_ROOT$/shared/**'],
      passThroughEnv: ['HOME']
    };

    it('WHEN its task is built THEN dependsOn lists them verbatim before the carrier', () => {
      const { file } = buildAtomTask(inputWithConfig(config));

      expect(file.definition.dependsOn).toEqual(['^build', 'web#build', 'e2e-ci-src--tests/login.spec.ts']);
    });

    it('WHEN its task is built THEN extraInputs come last in inputs', () => {
      const { file } = buildAtomTask(inputWithConfig(config));

      expect(file.definition.inputs?.at(-1)).toBe('$TURBO_ROOT$/shared/**');
    });

    it('WHEN its task is built THEN env lists them before TURBO_ATOMIZER_ARGS and passThroughEnv verbatim', () => {
      const { file } = buildAtomTask(inputWithConfig(config));

      expect(file.definition.env).toEqual(['BASE_URL', 'TURBO_ATOMIZER_ARGS']);
      expect(file.definition.passThroughEnv).toEqual(['HOME']);
    });
  });

  describe('GIVEN a config env that repeats names', () => {
    it('WHEN it already lists TURBO_ATOMIZER_ARGS THEN env keeps one copy in its first position', () => {
      const config: AtomizerConfig = { ...ATOMIZER_CONFIG_STUB, env: ['TURBO_ATOMIZER_ARGS', 'BASE_URL'] };

      const { file } = buildAtomTask(inputWithConfig(config));

      expect(file.definition.env).toEqual(['TURBO_ATOMIZER_ARGS', 'BASE_URL']);
    });

    it('WHEN it already lists commitEnv THEN env keeps one copy in its first position', () => {
      const config: AtomizerConfig = { ...COMMITTED_LIVE_CONFIG, env: ['BASE_URL', 'GIT_SHA'] };
      const input: AtomTaskInput = { ...COMMITTED_LIVE_INPUT, config };

      const { file } = buildAtomTask(input);

      expect(file.definition.env).toEqual(['BASE_URL', 'GIT_SHA', 'TURBO_ATOMIZER_ARGS']);
    });
  });
});
