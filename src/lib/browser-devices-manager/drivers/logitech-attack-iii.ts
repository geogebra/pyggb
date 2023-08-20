import { BrowserDeviceSpecifier, StringKeyedObject } from "../core-types";
import { BrowserDeviceManager } from "../manager";
import { HidDeviceDriver, HidHandledDevice } from "../substrates/hid";

class Attack3_Device extends HidHandledDevice {
  acceptInputReport(event: HIDInputReportEvent): Array<StringKeyedObject> {
    const x = event.data.getUint8(0);
    const y = event.data.getUint8(1);
    const z = event.data.getUint8(2);
    const bs0 = event.data.getUint8(3);
    const bs1 = event.data.getUint8(4);

    const buttons = [
      (bs0 & 0x01) === 0x01,
      (bs0 & 0x02) === 0x02,
      (bs0 & 0x04) === 0x04,
      (bs0 & 0x08) === 0x08,
      (bs0 & 0x10) === 0x10,
      (bs0 & 0x20) === 0x20,
      (bs0 & 0x40) === 0x40,
      (bs0 & 0x80) === 0x80,
      (bs1 & 0x01) === 0x01,
      (bs1 & 0x02) === 0x02,
      (bs1 & 0x04) === 0x04,
    ];

    return [{ x, y, z, buttons }];
  }
}

class Attack3_Driver extends HidDeviceDriver {
  canProvide(spec: BrowserDeviceSpecifier) {
    // TODO: Do this properly, once decided on spec format.
    return spec === "Attack III";
  }

  canHandleDevice(
    device: HIDDevice,
    _specifier: BrowserDeviceSpecifier
  ): boolean {
    return device.vendorId === 0x046d && device.productId === 0xc214;
  }

  filtersFromSpecifier(
    _specifier: BrowserDeviceSpecifier
  ): Array<HIDDeviceFilter> {
    return [{ vendorId: 0x046d, productId: 0xc214 }];
  }

  deviceClass() {
    return Attack3_Device;
  }
}

export function register(manager: BrowserDeviceManager) {
  manager.registerDriver(new Attack3_Driver());
}
