import { recommended } from 'lint-suite/eslint';
import type { ConfigArray } from 'typescript-eslint';

import { workspaceConfig } from '../eslint.config.base.ts';

const languageOptions = {
  parserOptions: {
    tsconfigRootDir: import.meta.dirname
  }
};

const typescriptFiles = {
  name: 'tools/typescript',
  files: ['**/*.ts'],
  languageOptions
};

const config: ConfigArray = [...recommended, ...workspaceConfig, typescriptFiles];

export default config;
