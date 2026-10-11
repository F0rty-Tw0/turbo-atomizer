import { expect, test } from '@playwright/test';

import { openHome } from '../support/home';

test('search accepts a query', async ({ page }) => {
  await openHome(page);
  await page.getByRole('searchbox').fill('shoes');
  await expect(page.getByRole('searchbox')).toHaveValue('shoes');
});
