import { createHmac, timingSafeEqual } from 'node:crypto';

/** Spec §7 Rendezvous handshake: only a holder of `token` can answer `nonce` with this proof. */
export const proofOf = (token: string, nonce: string): string => {
  return createHmac('sha256', token).update(nonce).digest('hex');
};

/** Constant-time check of `proof` against the expected proof; a proof of another length never matches. */
export const isProofOf = (proof: string, token: string, nonce: string): boolean => {
  const expected = Buffer.from(proofOf(token, nonce));
  const actual = Buffer.from(proof);

  if (actual.length !== expected.length) return false;

  return timingSafeEqual(actual, expected);
};
