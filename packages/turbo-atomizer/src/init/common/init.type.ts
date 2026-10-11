import type { JsonEdit, TurboJsonContent } from '../../shared/turbo/common/turbo-json.type.ts';

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
