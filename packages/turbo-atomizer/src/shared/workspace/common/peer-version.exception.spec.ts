import { describe, expect, it } from 'vitest';

import { PeerVersionException } from './peer-version.exception.ts';
import type { PeerVersionFinding } from './workspace.type.ts';

describe('FEATURE: peer version exception', (): void => {
  it('GIVEN two error findings WHEN the exception is built THEN its message lists both, one per line', (): void => {
    const turbo: PeerVersionFinding = { level: 'error', peer: 'turbo', version: '2.10.0', message: 'turbo too old' };
    const playwright: PeerVersionFinding = {
      level: 'error',
      peer: '@playwright/test',
      version: '1.55.0',
      message: 'playwright too old'
    };

    const exception = new PeerVersionException([turbo, playwright]);

    expect(exception.message).toBe('turbo too old\nplaywright too old');
  });
});
