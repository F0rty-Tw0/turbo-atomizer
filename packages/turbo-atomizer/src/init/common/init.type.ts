import type { JsonEdit, TurboJsonContent } from '../../shared/turbo/common/turbo-json.type.ts';
import type { SyncResult } from '../../sync/common/sync.type.ts';

export type GeneratedPackage = {
  readonly name: string;
  readonly dir: string;
};

export type GeneratedPackageFiles = {
  readonly packageJson: string;
  readonly turboJson: string;
};

type TurboJsonCreatePlan = {
  readonly kind: 'create';
  readonly content: TurboJsonContent;
};

type TurboJsonEditPlan = {
  readonly kind: 'edit';
  readonly edits: JsonEdit[];
};

type TurboJsonUnchangedPlan = {
  readonly kind: 'unchanged';
};

type TurboJsonConflictPlan = {
  readonly kind: 'conflict';
  readonly message: string;
};

/** What init step 8 does to the test package's turbo.json. */
export type TurboJsonPlan = TurboJsonConflictPlan | TurboJsonCreatePlan | TurboJsonEditPlan | TurboJsonUnchangedPlan;

/** What init did to one test package (spec §6.1 step 12). */
export type InitReport = {
  /** Files init wrote; empty on a re-run, which also skips the install. */
  readonly changes: string[];
  readonly lockfile: string;
  /** The remaining setup steps when sync was skipped (step 11); empty when it ran. */
  readonly nextSteps: string[];
  readonly packageDir: string;
  readonly sync: SyncResult | undefined;
  readonly warnings: string[];
};
