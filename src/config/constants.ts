import { path as appRoot } from 'app-root-path';
import * as path from 'path';

/**
 * Library constants
 */
export class Constants {
  /**
   * The library root. When this library is used
   * as a dependency in a project, the "libRoot"
   * will be the path to the dependency folder,
   * inside the "node_modules".
   */
  public libRoot: string;

  /**
   * The app root. When this library is used
   * as a dependency in a project, the "appRoot"
   * will be the path to the root project!
   */
  public appRoot: string;

  constructor() {
    // From the "dist/src/config" folder
    this.libRoot = path.normalize(__dirname + '/../../..');
    this.appRoot = appRoot;
  }

  /**
   * Extra values that we can add to the original Express request.
   */
  get requestExtraVariables() {
    return {
      cidReceivedInRequest: '_cidReceivedInRequest',
      cidNew: '_cidNew'
    };
  }
}

export let constants: Constants = new Constants();
