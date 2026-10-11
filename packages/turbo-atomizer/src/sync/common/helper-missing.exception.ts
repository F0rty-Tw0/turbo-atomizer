export class HelperMissingException extends Error {
  public readonly packageDir: string;

  public constructor(packageDir: string, configFile: string) {
    super(
      `${configFile} in ${packageDir} carries no turbo-atomizer metadata; wrap its export: export default withAtomizer(defineConfig({ ... })), with withAtomizer from 'turbo-atomizer/playwright'.`
    );
    this.name = 'HelperMissingException';
    this.packageDir = packageDir;
  }
}
