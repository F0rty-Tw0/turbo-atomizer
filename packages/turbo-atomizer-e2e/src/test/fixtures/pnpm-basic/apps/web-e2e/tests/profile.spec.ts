import { expect, test } from '@playwright/test';

import { openHome } from '../support/home';

test('profile is linked', async ({ page }) => {
  await openHome(page);
  await expect(page.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile');
  // The ci-retry e2e sets ATOMIZER_E2E_FAIL=1 to fail this spec without changing any task hash.
  expect(process.env.ATOMIZER_E2E_FAIL, 'ATOMIZER_E2E_FAIL=1 fails this spec on purpose').not.toBe('1');
});
