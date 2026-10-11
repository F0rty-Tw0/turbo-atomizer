import { expect, test } from '@playwright/test';

import { openHome } from '../support/home';

test('cart is linked', async ({ page }) => {
  await openHome(page);
  await expect(page.getByRole('link', { name: 'Cart' })).toHaveAttribute('href', '/cart');
});
