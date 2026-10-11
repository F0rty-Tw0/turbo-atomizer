import { writeFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

const isAtomizerKey = (key: string): boolean => key.startsWith('PLAYWRIGHT_') || key.startsWith('TURBO_ATOMIZER');

const dumpAtomizerEnv = (file: string): void => {
  const entries = Object.entries(process.env).filter(([key]) => isAtomizerKey(key));

  writeFileSync(file, JSON.stringify(Object.fromEntries(entries)));
};

test('a works', () => {
  const envOut = process.env['ATOMIZER_FIXTURE_ENV_OUT'];

  if (envOut !== undefined) dumpAtomizerEnv(envOut);

  expect(1 + 1).toBe(2);
});
