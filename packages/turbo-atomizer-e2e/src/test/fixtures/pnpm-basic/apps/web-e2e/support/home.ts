import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// ATOMIZER_E2E_HANG holds every test open this long, so its processes outlive a kill of turbo only if the kill fails
const HANG_MS = 120_000;

export const openHome = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Atomizer fixture' })).toBeVisible();

  if (process.env['ATOMIZER_E2E_HANG'] === undefined) return;

  test.setTimeout(HANG_MS * 2);
  await page.waitForTimeout(HANG_MS);
};
