export class TurboQueryException extends Error {
  public readonly stderrTail: string;

  public constructor(details: string, stderrTail: string, options?: ErrorOptions) {
    super(`turbo query failed: ${details}\n${stderrTail}`, options);
    this.name = 'TurboQueryException';
    this.stderrTail = stderrTail;
  }
}
