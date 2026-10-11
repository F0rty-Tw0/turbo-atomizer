export class TurboJsonInvalidException extends Error {
  public readonly location: string;

  public constructor(location: string, details: string) {
    super(`Invalid turbo.json in ${location}:\n${details}`);
    this.name = 'TurboJsonInvalidException';
    this.location = location;
  }
}
