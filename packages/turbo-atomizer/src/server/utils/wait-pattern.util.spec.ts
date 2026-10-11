import { describe, expect, it } from 'vitest';

import { matchWaitPattern } from './wait-pattern.util.ts';
import type { WaitPattern } from '../common/server-protocol.type.ts';

describe('FEATURE: wait pattern', () => {
  describe('GIVEN a pattern with a named PORT group', () => {
    const pattern: WaitPattern = { source: 'ready on (?<PORT>\\d+)', flags: '' };

    it('WHEN the output matches THEN the named group is captured', () => {
      const groups = matchWaitPattern(pattern, 'vite: ready on 4173\n');

      expect(groups).toEqual({ PORT: '4173' });
    });

    it('WHEN the output does not match THEN nothing is captured', () => {
      const groups = matchWaitPattern(pattern, 'compiling...\n');

      expect(groups).toBeUndefined();
    });
  });

  describe('GIVEN a pattern with an optional named group that does not participate', () => {
    it('WHEN the output matches THEN the missing group is left out', () => {
      const pattern: WaitPattern = { source: 'ready(?: on (?<PORT>\\d+))?', flags: '' };

      const groups = matchWaitPattern(pattern, 'ready\n');

      expect(groups).toEqual({});
    });
  });

  describe('GIVEN a pattern without named groups', () => {
    it('WHEN the output matches THEN an empty capture is returned', () => {
      const pattern: WaitPattern = { source: 'listening', flags: '' };

      const groups = matchWaitPattern(pattern, 'listening\n');

      expect(groups).toEqual({});
    });
  });

  describe('GIVEN a case-insensitive pattern', () => {
    it('WHEN the output differs in case THEN the flags are honoured', () => {
      const pattern: WaitPattern = { source: 'READY', flags: 'i' };

      const groups = matchWaitPattern(pattern, 'ready\n');

      expect(groups).toEqual({});
    });
  });

  describe('GIVEN a pattern with a lower-case named group', () => {
    it('WHEN the output matches THEN the env key is upper-cased like Playwright does', () => {
      const pattern: WaitPattern = { source: 'ready on (?<my_port>\\d+)', flags: '' };

      const groups = matchWaitPattern(pattern, 'ready on 4173\n');

      expect(groups).toEqual({ ['MY_PORT']: '4173' });
    });
  });
});
