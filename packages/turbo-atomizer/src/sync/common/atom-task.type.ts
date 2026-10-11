import type { AtomizerConfig } from '../../shared/config/common/atomizer-config.type.ts';

export type AtomTaskInput = {
  readonly config: AtomizerConfig;
  readonly configInFile: boolean;
  readonly listLine: string;
  readonly needsBlob: boolean;
  readonly snapshotsShared: boolean;
  readonly taskPath: string;
};

export type TurboTaskDefinition = {
  readonly cache?: boolean;
  readonly command?: string[];
  readonly dependsOn?: string[];
  readonly env?: string[];
  readonly inputs?: string[];
  readonly outputs?: string[];
  readonly passThroughEnv?: string[];
  readonly tags?: string[];
};

export type TurboTask = {
  readonly definition: TurboTaskDefinition;
  readonly name: string;
};

export type AtomTask = {
  readonly carrier: TurboTask;
  readonly file: TurboTask;
};
