import { ILogger } from '@villedemontreal/logger';
import { configs } from './configs';

let libIsInited: boolean = false;

/**
 * Inits the library.
 */
export function init(loggerCreator: (name: string) => ILogger): void {
  if (!loggerCreator) {
    throw new Error(`The Logger Creator is required.`);
  }
  configs.setLoggerCreator(loggerCreator);

  // ==========================================
  // Set as being "properly initialized".
  // At the very end of the "init()" function!
  // ==========================================
  libIsInited = true;
}

/**
 * Is the library properly initialized?
 *
 * This function MUST be named "isInited()"!
 * Code using this library may loop over all its "@villemontreal"
 * dependencies and, if one of those exports a "isInited" fonction,
 * it will enforce that the lib has been properly initialized before
 * starting...
 */
export function isInited(): boolean {
  return libIsInited;
}
