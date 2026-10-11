import { defineConfig, globalIgnores } from 'eslint/config';

export const workspaceConfig = defineConfig([
  globalIgnores(['**/dist', '**/fixtures/**', '**/tmp/**'], 'workspace/ignores'),
  {
    name: 'workspace/rules',
    files: ['**/*.ts', '**/*.js'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint\\.config(\\.base)?\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*']
            }
          ]
        }
      ]
    }
  }
]);
