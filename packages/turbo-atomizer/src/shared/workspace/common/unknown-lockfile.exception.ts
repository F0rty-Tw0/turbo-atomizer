export class UnknownLockfileException extends Error {
  public readonly root: string;
  public readonly lockfile: string | undefined;

  public constructor(root: string, lockfile: string | undefined) {
    const found = lockfile ?? 'no lockfile';

    super(`turbo-atomizer supports pnpm and npm, but ${root} has neither pnpm-lock.yaml nor package-lock.json (found ${found}).`);
    this.name = 'UnknownLockfileException';
    this.root = root;
    this.lockfile = lockfile;
  }
}
