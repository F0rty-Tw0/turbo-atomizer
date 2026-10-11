import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { editTurboJson, readTurboJson } from './turbo-json.store.ts';
import type { FixtureCopy } from '../../../test/common/fixture-copy.type.ts';
import { fixtureDirectory } from '../../../test/utils/fixture-copy.spec.util.ts';
import { TurboJsonInvalidException } from '../common/turbo-json-invalid.exception.ts';
import type { JsonEdit } from '../common/turbo-json.type.ts';
import { copyTurboFixture, turboFixtureDir } from '../test/utils/turbo-fixture.spec.util.ts';

const commandFlag: JsonEdit = { path: ['futureFlags', 'experimentalTaskCommand'], value: true };

describe('FEATURE: turbo.json store', (): void => {
  describe('GIVEN a directory with a turbo.json', (): void => {
    it('WHEN it is read THEN the parsed content and its path are returned', async (): Promise<void> => {
      const directory = fixtureDirectory('basic');
      const content = { $schema: 'https://turborepo.com/schema.json', agentGuidance: false, tasks: {} };
      const expected = { content, path: join(directory, 'turbo.json') };

      const doc = await readTurboJson(directory);

      expect(doc).toEqual(expected);
    });
  });

  describe('GIVEN a turbo.jsonc with a comment', (): void => {
    let workspace: FixtureCopy;

    beforeEach(async (): Promise<void> => {
      workspace = await copyTurboFixture('jsonc-workspace');
    });

    afterEach(async (): Promise<void> => {
      await workspace.dispose();
    });

    it('WHEN it is read THEN JSONC is parsed from turbo.jsonc', async (): Promise<void> => {
      const doc = await readTurboJson(workspace.directory);

      expect(doc?.path).toBe(join(workspace.directory, 'turbo.jsonc'));
    });

    describe('WHEN futureFlags.experimentalTaskCommand is added', (): void => {
      it('THEN the bytes changed', async (): Promise<void> => {
        const changed = await editTurboJson(workspace.directory, [commandFlag]);

        expect(changed).toBe(true);
      });

      it('THEN the flag is set and the comment is kept', async (): Promise<void> => {
        await editTurboJson(workspace.directory, [commandFlag]);

        const text = await readFile(join(workspace.directory, 'turbo.jsonc'), 'utf8');
        const doc = await readTurboJson(workspace.directory);

        expect(text).toContain('// keep: workspace-wide task defaults');
        expect(doc?.content.futureFlags).toEqual({ experimentalTaskCommand: true });
      });
    });

    it('WHEN an edit already holds THEN false is returned', async (): Promise<void> => {
      await editTurboJson(workspace.directory, [commandFlag]);

      const changed = await editTurboJson(workspace.directory, [commandFlag]);

      expect(changed).toBe(false);
    });
  });

  describe('GIVEN a directory without turbo.json or turbo.jsonc', (): void => {
    let workspace: FixtureCopy;

    beforeEach(async (): Promise<void> => {
      workspace = await copyTurboFixture('jsonc-workspace');
    });

    afterEach(async (): Promise<void> => {
      await workspace.dispose();
    });

    it('WHEN it is read THEN undefined is returned', async (): Promise<void> => {
      const doc = await readTurboJson(join(workspace.directory, 'packages/app'));

      expect(doc).toBeUndefined();
    });

    it('WHEN it is edited THEN turbo.json is created with the edit', async (): Promise<void> => {
      const appDir = join(workspace.directory, 'packages/app');

      await editTurboJson(appDir, [commandFlag]);

      const text = await readFile(join(appDir, 'turbo.json'), 'utf8');

      expect(text).toBe('{\n  "futureFlags": {\n    "experimentalTaskCommand": true\n  }\n}\n');
    });
  });

  describe('GIVEN a turbo.json that is not valid JSONC', (): void => {
    it('WHEN it is read THEN it rejects with TurboJsonInvalidException', async (): Promise<void> => {
      const reading = readTurboJson(turboFixtureDir('broken-json'));

      await expect(reading).rejects.toBeInstanceOf(TurboJsonInvalidException);
    });
  });

  describe('GIVEN a turbo.json with tags', (): void => {
    it('WHEN it is read THEN the tags are returned', async (): Promise<void> => {
      const doc = await readTurboJson(turboFixtureDir('tagged-package'));

      expect(doc?.content.tags).toEqual(['atomizer:definitions']);
    });
  });

  describe('GIVEN a turbo.json whose tags is not an array', (): void => {
    it('WHEN it is read THEN it rejects with TurboJsonInvalidException', async (): Promise<void> => {
      const reading = readTurboJson(turboFixtureDir('string-tags'));

      await expect(reading).rejects.toBeInstanceOf(TurboJsonInvalidException);
    });
  });
});
