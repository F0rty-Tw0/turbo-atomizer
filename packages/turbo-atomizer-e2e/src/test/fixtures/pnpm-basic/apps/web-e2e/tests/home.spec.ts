import { expect, test } from '@playwright/test';

import { openHome } from '../support/home';

test('home shows the heading @smoke', async ({ page }) => {
  await openHome(page);
});

test('home has a title', async ({ page }) => {
  await openHome(page);
  await expect(page).toHaveTitle('Atomizer fixture');
});
