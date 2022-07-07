import { init } from '../config/init';
import { getTestingLoggerCreator } from '../utils/logger';

/**
 * Call this when your need to set
 * *Testing* configurations to the current
 * library, without the need for a calling code
 * to do so.
 *
 * A test Correlation Id will be used!
 */
export function setTestingConfigurations(): void {
  init(getTestingLoggerCreator());
}
