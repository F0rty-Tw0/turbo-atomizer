import { describe, expect, it } from 'vitest';

import { isProofOf, proofOf } from './rendezvous-proof.util.ts';
import { OTHER_TOKEN_STUB, TOKEN_STUB } from '../test/stubs/rendezvous-token.stub.ts';

const NONCE = '00112233445566778899aabbccddeeff';
const OTHER_NONCE = 'ffeeddccbbaa99887766554433221100';

describe('FEATURE: rendezvous proof', (): void => {
  describe('GIVEN a token and a nonce', (): void => {
    it('WHEN the proof is built THEN it is a 64-char hex HMAC', (): void => {
      const proof = proofOf(TOKEN_STUB, NONCE);

      expect(proof).toMatch(/^[0-9a-f]{64}$/);
    });

    it('WHEN its own proof is checked THEN it matches', (): void => {
      const proof = proofOf(TOKEN_STUB, NONCE);

      const isValid = isProofOf(proof, TOKEN_STUB, NONCE);

      expect(isValid).toBe(true);
    });

    it('WHEN a proof from another token is checked THEN it does not match', (): void => {
      const proof = proofOf(OTHER_TOKEN_STUB, NONCE);

      const isValid = isProofOf(proof, TOKEN_STUB, NONCE);

      expect(isValid).toBe(false);
    });

    it('WHEN a proof for another nonce is checked THEN it does not match', (): void => {
      const proof = proofOf(TOKEN_STUB, OTHER_NONCE);

      const isValid = isProofOf(proof, TOKEN_STUB, NONCE);

      expect(isValid).toBe(false);
    });

    it('WHEN a proof of another length is checked THEN it does not match', (): void => {
      const isValid = isProofOf('abc', TOKEN_STUB, NONCE);

      expect(isValid).toBe(false);
    });
  });
});
