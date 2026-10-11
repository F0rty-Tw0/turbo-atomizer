type UncachedConfig = {
  readonly commitEnv?: string;
  readonly patterns: string[];
};

type ServerConfig = {
  readonly idleMs: number;
};

export type AtomizerConfig = {
  readonly dependsOn: string[];
  readonly env: string[];
  readonly extraInputs: string[];
  readonly failOnFlaky: boolean;
  readonly generatedPackage: string;
  readonly passThroughEnv: string[];
  readonly playwrightConfig: string;
  readonly server: ServerConfig;
  readonly snapshotGlobs: string[];
  readonly specGlobs: string[];
  readonly task: string;
  readonly uncached: UncachedConfig;
};

type PackageDerivedField = 'generatedPackage' | 'playwrightConfig';

export type ParsedAtomizerConfig = Omit<AtomizerConfig, PackageDerivedField> &
  Partial<Pick<AtomizerConfig, PackageDerivedField>>;

export type AtomizerConfigSource = 'default' | 'file' | 'package-json';

export type LoadedAtomizerConfig = {
  readonly config: AtomizerConfig;
  readonly source: AtomizerConfigSource;
};
