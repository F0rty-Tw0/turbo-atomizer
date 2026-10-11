export class WorkspaceRootMissingException extends Error {
  public readonly fromDir: string;

  public constructor(fromDir: string) {
    super(`No turbo.json or turbo.jsonc found in ${fromDir} or any parent directory; run from inside a turbo workspace.`);
    this.name = 'WorkspaceRootMissingException';
    this.fromDir = fromDir;
  }
}
