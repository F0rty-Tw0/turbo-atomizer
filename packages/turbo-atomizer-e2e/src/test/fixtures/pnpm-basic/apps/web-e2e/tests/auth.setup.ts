import { expect, test as setup } from '@playwright/test';

setup('the app answers', async ({ request }) => {
  const response = await request.get('/');

  expect(response.ok()).toBe(true);
});
