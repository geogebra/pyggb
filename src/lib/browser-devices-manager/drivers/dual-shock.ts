import { BrowserDeviceSpecifier, StringKeyedObject } from "../core-types";
import { BrowserDeviceManager } from "../manager";
import { HidDeviceDriver, HidHandledDevice } from "../substrates/hid";

const vendorIdsWithProductIds = [
  { vendorId: 0x054c, productId: 0x0ba0 },
  { vendorId: 0x054c, productId: 0x05c4 },
  { vendorId: 0x054c, productId: 0x09cc },
  { vendorId: 0x054c, productId: 0x05c5 },
  // Razer Raiju
  { vendorId: 0x1532, productId: 0x1000 },
  { vendorId: 0x1532, productId: 0x1007 },
  { vendorId: 0x1532, productId: 0x1004 },
  { vendorId: 0x1532, productId: 0x1009 },
  // Nacon Revol
  { vendorId: 0x146b, productId: 0x0d01 },
  { vendorId: 0x146b, productId: 0x0d02 },
  { vendorId: 0x146b, productId: 0x0d08 },
  // Other third party controllers
  { vendorId: 0x0f0d, productId: 0x00ee },
  { vendorId: 0x7545, productId: 0x0104 },
  { vendorId: 0x2e95, productId: 0x7725 },
  { vendorId: 0x11c0, productId: 0x4001 },
  { vendorId: 0x0c12, productId: 0x57ab },
  { vendorId: 0x0c12, productId: 0x0e16 },
  { vendorId: 0x0f0d, productId: 0x0084 },
];

class DualShock4_Device extends HidHandledDevice {
  acceptInputReport(event: HIDInputReportEvent): Array<StringKeyedObject> {
    var t = event.data;
    var data = new Uint8Array(event.data.buffer);

    let ret: StringKeyedObject = {};

    ret["leftStickX"] = data[0];
    ret["leftStickY"] = data[1];
    ret["rightStickX"] = data[2];
    ret["rightStickY"] = data[3];

    const buttons = data[4];
    ret["triangle"] = !!(128 & buttons);
    ret["circle"] = !!(64 & buttons);
    ret["cross"] = !!(32 & buttons);
    ret["square"] = !!(16 & buttons);

    const dPad = 15 & buttons;
    ret["dPadUp"] = 7 === dPad || 0 === dPad || 1 === dPad;
    ret["dPadRight"] = 1 === dPad || 2 === dPad || 3 === dPad;
    ret["dPadDown"] = 3 === dPad || 4 === dPad || 5 === dPad;
    ret["dPadLeft"] = 5 === dPad || 6 === dPad || 7 === dPad;

    const r = data[5];
    ret["l1"] = !!(1 & r);
    ret["r1"] = !!(2 & r);
    ret["share"] = !!(16 & r);
    ret["options"] = !!(32 & r);
    ret["l3"] = !!(64 & r);
    ret["r3"] = !!(128 & r);

    // digital versions (omit)
    //ret["l2"]= !!(4 & r);
    //ret["r2"]= !!(8 & r);
    const a = data[6];
    // analogue versions
    ret["l2"] = data[7];
    ret["r2"] = data[8];
    ret["playStation"] = !!(1 & a);
    ret["touchPadClick"] = !!(2 & a);

    ret["charging"] = !!(16 & data[29]);
    //ret["battery (if charging)"]= Math.floor(100 * (15 & data[29]) / 11);
    //ret["battery (if not charging)"]= Math.min(100, Math.floor(100 * (15 & data[29]) / 8));

    ret["gyroX"] = t.getUint16(13);
    ret["gyroY"] = t.getUint16(15);
    ret["gyroZ"] = t.getUint16(17);
    ret["accelX"] = t.getInt16(19);
    ret["accelY"] = t.getInt16(21);
    ret["accelZ"] = t.getInt16(23);

    let touches: Array<StringKeyedObject> = [];

    128 & data[34] ||
      touches.push({
        touchId: 127 & data[34],
        x: ((15 & data[36]) << 8) | data[35],
        y: (data[37] << 4) | ((240 & data[36]) >> 4),
      });
    128 & data[38] ||
      touches.push({
        touchId: 127 & data[38],
        x: ((15 & data[40]) << 8) | data[39],
        y: (data[41] << 4) | ((240 & data[40]) >> 4),
      });

    ret["touches"] = touches;

    return [ret];
  }
}

class DualShock4_Driver extends HidDeviceDriver {
  canProvide(specifier: BrowserDeviceSpecifier) {
    return specifier === "SonyDualShock4";
  }

  canHandleDevice(device: HIDDevice, _specifier: BrowserDeviceSpecifier) {
    return vendorIdsWithProductIds.some(
      (ids) =>
        ids.vendorId === device.vendorId && ids.productId === device.productId
    );
  }

  filtersFromSpecifier(
    _specifier: BrowserDeviceSpecifier
  ): Array<HIDDeviceFilter> {
    return vendorIdsWithProductIds;
  }

  deviceClass() {
    return DualShock4_Device;
  }
}

export function register(manager: BrowserDeviceManager) {
  manager.registerDriver(new DualShock4_Driver());
}
