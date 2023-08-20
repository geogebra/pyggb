import { BrowserDeviceSpecifier, StringKeyedObject } from "../core-types";
import { BrowserDeviceManager } from "../manager";
import {
  BleDeviceDriver,
  BleHandledDevice,
  ScopedCharacteristics,
} from "../substrates/ble";

// TODO: Use these?
//
// const EVENT_CLAP = [49, 68, 48, 49];
//
// 6 bytes in total, last byte is orientation
// not sure about others
// const EVENT_ORIENTATION = [55, 57];
//
// const EVENT_GESTURE = [48, 65];

const EVENT_RADAR = [48, 67, 48];

function match(data: Uint8Array, event: Array<number>) {
  // QUERY: This was "data.length < data.event" but Uint8Array has
  // no "event" property.
  if (data.length < event.length) {
    return false;
  }

  for (let i = 0; i < event.length; i++) {
    if (data[i] !== event[i]) {
      return false;
    }
  }

  return true;
}

class WowweeMipRobot_Device extends BleHandledDevice {
  acceptCharacteristicValue(
    _serviceUuid: BluetoothServiceUUID,
    _charUuid: BluetoothCharacteristicUUID,
    value: DataView
  ): Array<StringKeyedObject> {
    // QUERY: This was "event.srcElement.value.buffer", but no "event"
    // in scope.
    var data = new Uint8Array(value.buffer);

    if (match(data, EVENT_RADAR)) {
      switch (data[3]) {
        case 49:
          // far
          return [{ radarEvent: 2 }];
        case 50:
          // medium
          return [{ radarEvent: 1 }];
        case 51:
          // QUERY: This is the same value as "medium".
          // near
          return [{ radarEvent: 1 }];
        default:
          // unknown
          return [{ radarEvent: NaN }];
      }
    }

    return [{ unknownEvent: data }];
  }
}

class WowweeMipRobot_Driver extends BleDeviceDriver {
  canProvide(spec: BrowserDeviceSpecifier) {
    return spec === "WowWeeMiP";
  }

  canHandleDevice(
    device: BluetoothDevice,
    _specifier: BrowserDeviceSpecifier
  ): boolean {
    const name = device.name ?? "";
    return name.startsWith("Mip-");
  }

  deviceClass() {
    return WowweeMipRobot_Device;
  }

  handledCharacteristics(): Array<ScopedCharacteristics> {
    return [
      {
        // transmit
        serviceUuid: "0000ffe5-0000-1000-8000-00805f9b34fb",
        charUuids: ["0000ffe9-0000-1000-8000-00805f9b34fb"],
      },
      {
        // receive
        serviceUuid: "0000ffe0-0000-1000-8000-00805f9b34fb",
        charUuids: ["0000ffe4-0000-1000-8000-00805f9b34fb"],
      },
    ];
  }

  // TODO: namePrefix() method
}

export function register(manager: BrowserDeviceManager) {
  manager.registerDriver(new WowweeMipRobot_Driver());
}
