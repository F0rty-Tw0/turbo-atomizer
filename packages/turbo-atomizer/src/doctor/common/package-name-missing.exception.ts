export class PackageNameMissingException extends Error {
  public readonly packageDir: string;

  public constructor(packageDir: string) {
    super(`${packageDir}/package.json has no name; turbo needs it to find the test package's workspace dependencies.`);
    this.name = 'PackageNameMissingException';
    this.packageDir = packageDir;
  }
}
