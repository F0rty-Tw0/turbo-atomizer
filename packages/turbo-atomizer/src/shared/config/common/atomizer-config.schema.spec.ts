import { describe, expect, it } from 'vitest';

import { atomizerConfigSchema } from './atomizer-config.schema.ts';

describe('FEATURE: atomizer config schema', (): void => {
  describe('GIVEN a task name turbo would misread', (): void => {
    const rejectedTasks = ['web#e2e', '^e2e', '$e2e', 'e2e ci', '-e2e', '.e2e', 'e2e/ci'];

    it.each(rejectedTasks)('WHEN { task: %j } is parsed THEN it fails on the task field', (task): void => {
      const result = atomizerConfigSchema.safeParse({ task });
      const paths = result.error?.issues.map((issue) => issue.path);

      expect(paths).toEqual([['task']]);
    });

    it('WHEN { task: "web#e2e" } is parsed THEN the message says turbo reads "#" as package#task', (): void => {
      const result = atomizerConfigSchema.safeParse({ task: 'web#e2e' });

      expect(result.error?.message).toContain('package#task');
    });
  });

  describe('GIVEN a task name turbo accepts', (): void => {
    const acceptedTasks = ['e2e', 'e2e-ci', 'e2e:ci', 'test.e2e', '_e2e', 'E2E_1'];

    it.each(acceptedTasks)('WHEN { task: %j } is parsed THEN it succeeds', (task): void => {
      const result = atomizerConfigSchema.safeParse({ task });

      expect(result.success).toBe(true);
    });
  });
});
