import { BrowserDeviceSpecifier, StringKeyedObject } from "../core-types";
import { BrowserDeviceDriver } from "../driver-interfaces";
import { BrowserHandledDevice } from "./common";
import { BrowserDeviceManager } from "../manager";

// Subtypes:
//
// HidDeviceDriver : BrowserDeviceDriver
// HidHandledDevice : BrowserHandledDevice
//
// Concrete HID device drivers must implemented subclasses of those.

export class HidHandledDevice extends BrowserHandledDevice {
  // Private use only:
  constructor(readonly device_: HIDDevice) {
    super();
  }

  browserDevice(): HIDDevice {
    return this.device_;
  }

  closeBrowserDevice(): void {
    this.device_.close();
  }

  ////////////////////////////////////////////////////////////////////////
  // Concrete HID device implementations must implement the following.
  //
  acceptInputReport(_event: HIDInputReportEvent): Array<StringKeyedObject> {
    throw new Error("HidHandledDevice.acceptInputReport(): not implemented");
  }
  ////////////////////////////////////////////////////////////////////////
}

type HandledDeviceConstructor = new (device: HIDDevice) => HidHandledDevice;

export class HidDeviceDriver extends BrowserDeviceDriver {
  ////////////////////////////////////////////////////////////////////////
  // Concrete HID device drivers must implement the following.
  //
  /** Can this device driver, in general, supply a device meeting the
   * given specifier?  This question is independent of whether there is
   * any such device actually connected right now. */
  canProvide(_specifier: BrowserDeviceSpecifier): boolean {
    throw this._notImplementedError("canProvide");
  }
  //
  /** Can this device driver handle the given device?  The specifier is
   * also provided in case it makes a difference to the answer. */
  canHandleDevice(
    _device: HIDDevice,
    _specifier: BrowserDeviceSpecifier
  ): boolean {
    throw this._notImplementedError("canHandleDevice");
  }
  //
  /** What filters (for `requestDevice()`) should be used when asking
   * the user to approve a device for handling by this driver? */
  filtersFromSpecifier(
    _specifier: BrowserDeviceSpecifier
  ): Array<HIDDeviceFilter> {
    throw this._notImplementedError("filtersFromSpecifier");
  }
  //
  /** What JavaScript class should be used to create a "handled device"
   * instance under this driver? */
  deviceClass(): HandledDeviceConstructor {
    throw this._notImplementedError("deviceClass");
  }
  ////////////////////////////////////////////////////////////////////////

  /** (Internal use.)  Construct a handled-HID-device for the given raw
   * HID device. */
  async createHandledDevice(device: HIDDevice): Promise<HidHandledDevice> {
    const deviceClass = this.deviceClass();
    const handledDevice = new deviceClass(device);
    await this.connectInputReportListener(handledDevice);
    return handledDevice;
  }

  /** (Internal use.)  Construct a new event listener for HID input
   * reports which uses the given `handledDevice` to translate the input
   * report into an array of normalised objects. */
  newInputReportListener(handledDevice: HidHandledDevice) {
    return (event: Event) => {
      handledDevice.enqueueReports(
        handledDevice.acceptInputReport(event as HIDInputReportEvent)
      );
    };
  }

  /** (Internal use.)  Set up an event listener for the given
   * `handledDevice`. */
  async connectInputReportListener(handledDevice: HidHandledDevice) {
    const device = handledDevice.browserDevice();
    await device.open();
    const listener = this.newInputReportListener(handledDevice);
    const abortSignal = handledDevice.eventListenerAbortController.signal;
    device.addEventListener("inputreport", listener, { signal: abortSignal });
  }

  /** Try to provide an HID Device satisfying the given specifier. */
  async tryProvideDevice(
    manager: BrowserDeviceManager,
    specifier: BrowserDeviceSpecifier
  ): Promise<HidHandledDevice | null> {
    console.log("HID tryProvideDevice()", specifier);
    if (!this.canProvide(specifier)) {
      console.log("can't provide");
      return null;
    }

    const allPermittedDevices = await navigator.hid.getDevices();
    for (const device of allPermittedDevices) {
      const leaseHolder = manager.leaseHolder(device);
      console.log("device", device, "has leaseHolder", leaseHolder);
      if (leaseHolder != null) {
        // Not available; someone (maybe the requesting session, or
        // maybe another session) under this manager already has a
        // lease.
        continue;
      }

      if (!this.canHandleDevice(device, specifier)) {
        // Unsuitable device for this driver.
        continue;
      }

      try {
        return await this.createHandledDevice(device);
      } catch (e) {
        console.log("failed to construct handled device", e);
        return null;
      }
    }

    // If we get here, none of the previously-permitted devices is
    // suitable.  Ask the user to choose and permit another one.

    const filters = this.filtersFromSpecifier(specifier);
    const grantedDevices = await navigator.hid.requestDevice({ filters });

    // TODO: Do we ever get more than one device back?
    const rawDevice = grantedDevices[0];

    // Perhaps the filters let through a device which we can't handle
    // after all.  (Maybe our filter asks for "any joystick" but there
    // are some makes/models which are known to not work properly, so
    // we have to check vID/pID against a blocklist.)
    if (!this.canHandleDevice(rawDevice, specifier)) {
      // TODO: Should the return type for this method be
      // Ok(device) | Error(reason)?
      console.log("can't handle user-chosen device");
      return null;
    }

    console.log("working with rawDevice", rawDevice);
    if (rawDevice.opened) {
      console.log("user-chosen device already in use");
      return null;
    }

    try {
      // Can we do anything more useful if this fails?
      return this.createHandledDevice(rawDevice);
    } catch (e) {
      console.log("open of", rawDevice, "failed:", e);
    }

    return null;
  }

  _notImplementedError(methodName: string) {
    return new Error(`HidDeviceDriver.${methodName}(): not implemented`);
  }
}
