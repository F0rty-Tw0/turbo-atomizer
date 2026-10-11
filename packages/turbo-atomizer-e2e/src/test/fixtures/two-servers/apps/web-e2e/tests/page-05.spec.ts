import { test } from '@playwright/test';

import { checkBothServers } from '../support/pages';

test('page 05 reaches both servers', async ({ page, request }) => {
  await checkBothServers(page, request);
});
