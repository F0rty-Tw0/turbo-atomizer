type InitCommand = {
  readonly command: 'init';
  readonly generatedDir?: string | undefined;
  readonly package?: string | undefined;
};

type SyncCommand = {
  readonly check: boolean;
  readonly command: 'sync';
  readonly package?: string | undefined;
};

type PackageCommand = {
  readonly command: 'doctor' | 'merge-reports';
  readonly package?: string | undefined;
};

type AffectedCommand = {
  readonly command: 'affected';
  /** Args after `--`, appended to `turbo run`. */
  readonly forwarded: string[];
  readonly package?: string | undefined;
};

type VersionCommand = {
  readonly command: 'version';
};

type UsageCommand = {
  readonly command: 'usage';
  readonly exitCode: 0 | 2;
  readonly message: string;
};

export type CliCommand = AffectedCommand | InitCommand | PackageCommand | SyncCommand | UsageCommand | VersionCommand;
