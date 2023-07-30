import { BrowserDeviceSpecifier, StringKeyedObject } from "../core-types";
import { BrowserDeviceManager } from "../manager";
import { HidDeviceDriver, HidHandledDevice } from "../substrates/hid";

class MantaMM812_Device extends HidHandledDevice {
  acceptInputReport(event: HIDInputReportEvent): Array<StringKeyedObject> {
    const x = event.data.getUint8(0);
    const y = event.data.getUint8(1);
    return [{ x, y }];
  }
}

class MantaMM812_Driver extends HidDeviceDriver {
  canProvide(specifier: BrowserDeviceSpecifier): boolean {
    return specifier === "gamepad";
  }

  canHandleDevice(
    device: HIDDevice,
    _specifier: BrowserDeviceSpecifier
  ): boolean {
    return device.vendorId === 0x081f && device.productId === 0xe401;
  }

  filtersFromSpecifier(
    _specifier: BrowserDeviceSpecifier
  ): Array<HIDDeviceFilter> {
    return [{ vendorId: 0x081f, productId: 0xe401 }];
  }

  deviceClass(): new (device: HIDDevice) => HidHandledDevice {
    return MantaMM812_Device;
  }
}

export function register(manager: BrowserDeviceManager) {
  manager.registerDriver(new MantaMM812_Driver());
}
