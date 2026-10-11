import { describe, expect, it } from 'vitest';

import { toStringEnv } from './string-env.util.ts';

describe('FEATURE: string env', (): void => {
  describe('GIVEN a process env with a string and an undefined value', (): void => {
    const processEnv: NodeJS.ProcessEnv = { HOME: '/home/user', UNSET: undefined };

    it('WHEN it is converted THEN only the string value is kept', (): void => {
      const env = toStringEnv(processEnv);

      expect(env).toStrictEqual({ HOME: '/home/user' });
    });

    it('WHEN it is converted THEN the input still holds the undefined key', (): void => {
      toStringEnv(processEnv);

      expect(Object.keys(processEnv)).toEqual(['HOME', 'UNSET']);
    });
  });

  describe('GIVEN an empty process env', (): void => {
    it('WHEN it is converted THEN the result is empty', (): void => {
      const env = toStringEnv({});

      expect(env).toStrictEqual({});
    });
  });
});
