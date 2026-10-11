import { expect } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

import { sideURL } from './servers';

export const checkBothServers = async (page: Page, request: APIRequestContext): Promise<void> => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Atomizer fixture' })).toBeVisible();

  const side = await request.get(sideURL);

  expect(side.ok()).toBe(true);
};
