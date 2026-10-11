import { test } from '@playwright/test';

import { checkBothServers } from '../support/pages';

test('page 01 reaches both servers', async ({ page, request }) => {
  await checkBothServers(page, request);
});
