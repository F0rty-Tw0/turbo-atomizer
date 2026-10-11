import { expect, test } from '@playwright/test';

import { openHome } from '../support/home';

test('profile is linked', async ({ page }) => {
  await openHome(page);
  await expect(page.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile');
});
