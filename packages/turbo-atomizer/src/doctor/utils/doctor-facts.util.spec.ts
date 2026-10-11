import { describe, expect, it } from 'vitest';

import { hasFutureFlag, toOutsideImports } from './doctor-facts.util.ts';
import type { TurboJsonDoc } from '../../shared/turbo/common/turbo-json.type.ts';

const rootTurboJson = (futureFlags: Record<string, unknown> | undefined): TurboJsonDoc => {
  const content = { futureFlags };
  const doc: TurboJsonDoc = { path: '/repo/turbo.json', content };

  return doc;
};

describe('FEATURE: doctor facts helpers', (): void => {
  describe('GIVEN the files a spec imports', (): void => {
    it('WHEN they are split THEN only files outside the package dir are outside imports', (): void => {
      const files = ['apps/web-e2e/helpers/h.ts', 'shared/x.ts', 'apps/web-e2e-shared/y.ts'];

      const outsideImports = toOutsideImports('tests/a.spec.ts', files, 'apps/web-e2e');

      expect(outsideImports).toEqual([
        { spec: 'tests/a.spec.ts', file: 'shared/x.ts' },
        { spec: 'tests/a.spec.ts', file: 'apps/web-e2e-shared/y.ts' }
      ]);
    });
  });

  describe('GIVEN a root turbo.json', (): void => {
    it('WHEN the flag is true THEN it is set', (): void => {
      const isSet = hasFutureFlag(rootTurboJson({ experimentalTaskCommand: true }), 'experimentalTaskCommand');

      expect(isSet).toBe(true);
    });

    it('WHEN the flag is false THEN it is not set', (): void => {
      const isSet = hasFutureFlag(rootTurboJson({ experimentalTaskCommand: false }), 'experimentalTaskCommand');

      expect(isSet).toBe(false);
    });

    it('WHEN there are no future flags THEN it is not set', (): void => {
      const isSet = hasFutureFlag(rootTurboJson(undefined), 'experimentalTaskCommand');

      expect(isSet).toBe(false);
    });
  });

  describe('GIVEN no root turbo.json', (): void => {
    it('WHEN a flag is read THEN it is not set', (): void => {
      const isSet = hasFutureFlag(undefined, 'experimentalTaskCommand');

      expect(isSet).toBe(false);
    });
  });
});
