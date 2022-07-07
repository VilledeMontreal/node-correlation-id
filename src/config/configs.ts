import { ILogger } from '@villedemontreal/logger';

/**
 * Http Client Config
 */
export class Configs {
  private loggerCreatorVar: (name: string) => ILogger;

  /**
   * Sets the Logger creator.
   */
  public setLoggerCreator(loggerCreator: (name: string) => ILogger) {
    this.loggerCreatorVar = loggerCreator;
  }

  /**
   * The Logger creator
   */
  get loggerCreator(): (name: string) => ILogger {
    if (!this.loggerCreatorVar) {
      throw new Error(`The Logger Creator HAS to be set as a configuration! Please call the init(...) fonction first.`);
    }
    return this.loggerCreatorVar;
  }
}
export let configs: Configs = new Configs();
