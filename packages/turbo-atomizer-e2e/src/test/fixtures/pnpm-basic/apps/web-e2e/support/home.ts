import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const openHome = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Atomizer fixture' })).toBeVisible();
};
