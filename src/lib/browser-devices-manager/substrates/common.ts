import { AnyPhysicalDevice } from ".";
import { StringKeyedObject } from "../core-types";
import { DeviceLeaseChannel } from "../device-lease-channel";

/** One actual concrete device owned and opened by the manager and
 * leased (or about to be leased) to some Session. */
export class BrowserHandledDevice implements DeviceLeaseChannel {
  reports: Array<StringKeyedObject>;
  eventListenerAbortController: AbortController;
  isClosed: boolean;

  constructor() {
    this.reports = [];
    this.eventListenerAbortController = new AbortController();
    this.isClosed = false;
  }

  /** (Must be overridden by subclass.)  Act on the given command from
   * the user. */
  async acceptCommand(_cmd: StringKeyedObject): Promise<void> {
    throw this._notImplementedError("acceptCommand");
  }

  /** (Must be overridden by subclass.)  Tell the browser we have
   * finished with this device. */
  closeBrowserDevice() {
    throw this._notImplementedError("closeBrowserDevice");
  }

  // Is this internal use?
  //
  /** (Must be overridden by subclass.)  Return the actual in-browser
   * device object, which can be of various types.  The only requirement
   * is that they can be compared for identity (`===`), both within and
   * across types.  (We assume that device objects of different
   * substrates (e.g., a SerialPort and a BluetoothDevice) never have
   * the same identity.) */
  browserDevice(): AnyPhysicalDevice {
    throw this._notImplementedError("browserDevice");
  }

  /** (Internal use.)  Collect the given `reports` into `this.reports`,
   * adding a `timestamp` property to each one. */
  enqueueReports(reports: Array<StringKeyedObject>) {
    // Divide by 1000 to get "seconds since epoch".
    const timestamp = Date.now() * 1.0e-3;
    for (const report of reports) {
      this.reports.push({ timestamp, ...report });
    }
  }

  /** Return an array of all the reports which have been received from
   * this device since the last time `drainReports()` was called.  (Or,
   * for the very first call to `drainReports()` on a particular device,
   * all the reports that have been received since that device was
   * opened.)
   * */
  drainReports(): Array<StringKeyedObject> {
    const reports = this.reports;
    this.reports = [];
    return reports;
  }

  /** Stop listening for events from this device, and "close" it.
   * (Whatever "close" means for the particular device.) */
  close() {
    // TODO: Or is it an error to close an already-closed device?
    if (!this.isClosed) {
      this.eventListenerAbortController.abort();
      this.closeBrowserDevice();
      this.isClosed = true;
    }
  }

  _notImplementedError(methodName: string) {
    return new Error(`BrowserHandledDevice.${methodName}(): not implemented`);
  }
}
