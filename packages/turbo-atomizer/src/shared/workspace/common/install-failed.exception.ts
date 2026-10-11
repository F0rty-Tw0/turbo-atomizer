export class InstallFailedException extends Error {
  public readonly command: string;
  public readonly exitCode: number | null;

  public constructor(command: string, exitCode: number | null, options?: ErrorOptions) {
    super(`"${command}" failed with exit code ${String(exitCode)}; fix the install and re-run turbo-atomizer init.`, options);
    this.name = 'InstallFailedException';
    this.command = command;
    this.exitCode = exitCode;
  }
}
