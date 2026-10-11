export class InitConflictException extends Error {
  public readonly location: string;

  public constructor(location: string, details: string) {
    super(`turbo-atomizer init cannot continue: ${location}: ${details}`);
    this.name = 'InitConflictException';
    this.location = location;
  }
}
