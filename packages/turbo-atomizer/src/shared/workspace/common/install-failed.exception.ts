import { NPM_LOCKFILE, PNPM_LOCKFILE } from './workspace.const.ts';
import type { PackageManager } from './workspace.type.ts';

/** A re-run of init changes nothing and so skips the install (spec §6.1 step 10), so the message names the manual install instead. */
export class InstallFailedException extends Error {
  public readonly command: string;
  public readonly exitCode: number | null;

  public constructor(pm: PackageManager, root: string, exitCode: number | null, options?: ErrorOptions) {
    const command = `${pm} install`;
    const lockfile = pm === 'pnpm' ? PNPM_LOCKFILE : NPM_LOCKFILE;

    super(
      `"${command}" failed with exit code ${String(exitCode)}; the init changes are in place, so fix the install, then run "${command}" in ${root} and commit ${lockfile}.`,
      options
    );
    this.name = 'InstallFailedException';
    this.command = command;
    this.exitCode = exitCode;
  }
}
