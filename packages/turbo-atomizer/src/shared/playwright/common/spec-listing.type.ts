import type { AtomizerMetadata } from '../../atomizer/common/atomizer.type.ts';

type ListedTest = {
  readonly projectName: string;
};

type ListedSpec = {
  readonly tests: ListedTest[];
};

export type ListedSuite = {
  readonly file: string;
  readonly specs: ListedSpec[];
  readonly suites?: ListedSuite[] | undefined;
};

type ListedConfigMetadata = {
  readonly 'turbo-atomizer'?: AtomizerMetadata | undefined;
};

type ListedConfig = {
  readonly metadata: ListedConfigMetadata;
  readonly rootDir: string;
};

/** The part of Playwright's `--list --reporter=json` report atomizer reads. */
export type PlaywrightListReport = {
  readonly config: ListedConfig;
  readonly suites: ListedSuite[];
};

export type SpecFile = {
  readonly absPath: string;
  readonly projects: string[];
};

export type SpecListing = {
  readonly files: SpecFile[];
  readonly metadata: AtomizerMetadata | undefined;
  readonly rootDir: string;
};

export type ListSpecsOptions = {
  readonly extraEnv?: Record<string, string>;
  readonly metadataOnly?: boolean;
};
