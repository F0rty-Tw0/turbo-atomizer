export class SpecRejectedException extends Error {
  public readonly file: string;

  public constructor(file: string, reason: string) {
    super(`Rejected ${file}: ${reason}`);
    this.name = 'SpecRejectedException';
    this.file = file;
  }
}
