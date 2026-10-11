import { expect, test } from '@playwright/test';

import { openHome } from '../support/home';

test('checkout heading matches its snapshot', async ({ page }) => {
  await openHome(page);

  const heading = await page.getByRole('heading').textContent();

  expect(heading).toMatchSnapshot('heading.txt');
});
