export class PlaywrightListException extends Error {
  public readonly stderrTail: string;

  public constructor(details: string, stderrTail: string, options?: ErrorOptions) {
    super(`playwright test --list failed: ${details}\n${stderrTail}`, options);
    this.name = 'PlaywrightListException';
    this.stderrTail = stderrTail;
  }
}
