export class ConfigConflictException extends Error {
  public readonly packageDir: string;

  public constructor(packageDir: string) {
    super(
      `Both turbo-atomizer.json and a "turbo-atomizer" key in package.json exist in ${packageDir}; keep only one.`
    );
    this.name = 'ConfigConflictException';
    this.packageDir = packageDir;
  }
}
