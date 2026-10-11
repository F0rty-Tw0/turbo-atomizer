import { describe, expect, it } from 'vitest';

import { parseJsonLine } from './json-line.util.ts';
import { nonceLineSchema } from '../common/server-protocol.schema.ts';

const NONCE = '00112233445566778899aabbccddeeff';

describe('FEATURE: JSON line parsing', (): void => {
  describe('GIVEN a line matching the schema', (): void => {
    it('WHEN it is parsed THEN the value is returned', (): void => {
      const parsed = parseJsonLine(`{"nonce":"${NONCE}"}`, nonceLineSchema);

      expect(parsed).toEqual({ nonce: NONCE });
    });
  });

  describe('GIVEN valid JSON that fails the schema', (): void => {
    it('WHEN it is parsed THEN undefined is returned', (): void => {
      const parsed = parseJsonLine('{"nonce":"short"}', nonceLineSchema);

      expect(parsed).toBeUndefined();
    });
  });

  describe('GIVEN a line that is not JSON', (): void => {
    it('WHEN it is parsed THEN undefined is returned', (): void => {
      const parsed = parseJsonLine('not json', nonceLineSchema);

      expect(parsed).toBeUndefined();
    });
  });
});
