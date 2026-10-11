import { describe, expect, it } from 'vitest';

import { toAtomSlug } from './atom-slug.util.ts';

describe('FEATURE: atom slug', () => {
  describe('GIVEN a posix task path', () => {
    it('WHEN it is slugged THEN separators and dots become dashes followed by the sha1 prefix of the path', () => {
      const slug = toAtomSlug('tests/login.spec.ts');

      expect(slug).toBe('tests-login-spec-ts-6b6dc3');
    });

    it('WHEN the live spec of the spec §4 example is slugged THEN it matches the documented slug', () => {
      const slug = toAtomSlug('tests/checkout.live.spec.ts');

      expect(slug).toBe('tests-checkout-live-spec-ts-4b1622');
    });
  });

  describe('GIVEN a Windows task path', () => {
    it('WHEN it is slugged THEN it equals the slug of the posix path', () => {
      const slug = toAtomSlug('tests\\login.spec.ts');

      expect(slug).toBe('tests-login-spec-ts-6b6dc3');
    });
  });

  describe('GIVEN two paths that differ only by a dash versus a separator', () => {
    it('WHEN both are slugged THEN the slugs differ', () => {
      const dashSlug = toAtomSlug('a-b.spec.ts');
      const separatorSlug = toAtomSlug('a/b.spec.ts');

      expect(dashSlug).not.toBe(separatorSlug);
    });
  });
});
