import { expect, test } from '@playwright/test';

import { openHome } from '../support/home';

test('sign in is offered @smoke', async ({ page }) => {
  await openHome(page);
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});
