export class ConfigInvalidException extends Error {
  public readonly location: string;

  public constructor(location: string, details: string, options?: ErrorOptions) {
    super(`Invalid turbo-atomizer config in ${location}:\n${details}`, options);
    this.name = 'ConfigInvalidException';
    this.location = location;
  }
}
