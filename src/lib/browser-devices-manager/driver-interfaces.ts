// TODO: Rename to "driver-base-classes.ts"?

import { BrowserDeviceSpecifier } from "./core-types";
import { BrowserHandledDevice } from "./substrates/common";
import { BrowserDeviceManager } from "./manager";

/** Abstract base class for device-drivers for hardware devices which
 * can be accessed from the browser. */
export class BrowserDeviceDriver {
  /** (Must be implemented by subclass.)  Attempt to provide a handled
   * device satisfying the given `specifier`.  The given `manager` is
   * available to answer questions about whether a particular candidate
   * device is already being leased. */
  tryProvideDevice(
    _manager: BrowserDeviceManager,
    _specifier: BrowserDeviceSpecifier
  ): Promise<BrowserHandledDevice | null> {
    throw new Error("BrowserDeviceDriver.tryProvideDevice(): not implemented");
  }
}
