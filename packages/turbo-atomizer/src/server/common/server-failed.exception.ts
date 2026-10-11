export class ServerFailedException extends Error {
  public readonly details: string;
  public readonly logTail: string;

  public constructor(details: string, logTail: string) {
    super(`web server failed: ${details}\n${logTail}`);
    this.name = 'ServerFailedException';
    this.details = details;
    this.logTail = logTail;
  }
}
