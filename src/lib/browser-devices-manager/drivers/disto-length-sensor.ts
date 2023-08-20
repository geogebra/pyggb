import { BrowserDeviceSpecifier, StringKeyedObject } from "../core-types";
import { BrowserDeviceManager } from "../manager";
import {
  BleDeviceDriver,
  BleHandledDevice,
  ScopedCharacteristics,
} from "../substrates/ble";

class DistoLengthSensor_Device extends BleHandledDevice {
  acceptCharacteristicValue(
    _serviceUuid: BluetoothServiceUUID,
    _charUuid: BluetoothCharacteristicUUID,
    value: DataView
  ): Array<StringKeyedObject> {
    return [{ lengthCM: value.getFloat32(0, true) }];
  }
}

class DistoLengthSensor_Driver extends BleDeviceDriver {
  canProvide(spec: BrowserDeviceSpecifier) {
    return spec === "Disto";
  }

  canHandleDevice(
    device: BluetoothDevice,
    _specifier: BrowserDeviceSpecifier
  ): boolean {
    const name = device.name ?? "";
    return name.startsWith("DISTO ");
  }

  deviceClass() {
    return DistoLengthSensor_Device;
  }

  handledCharacteristics(): Array<ScopedCharacteristics> {
    return [
      {
        serviceUuid: "3ab10100-f831-4395-b29d-570977d5bf94",
        charUuids: ["3ab10101-f831-4395-b29d-570977d5bf94"],
      },
    ];
  }

  // TODO: namePrefix() method
}

export function register(manager: BrowserDeviceManager) {
  manager.registerDriver(new DistoLengthSensor_Driver());
}
