import { BrowserDeviceSpecifier, StringKeyedObject } from "../core-types";
import { BrowserDeviceManager } from "../manager";
import {
  BleDeviceDriver,
  BleHandledDevice,
  ScopedCharacteristics,
} from "../substrates/ble";

const textDecoder = new TextDecoder();

class PicoTempSensor_Device extends BleHandledDevice {
  acceptCharacteristicValue(
    _serviceUuid: BluetoothServiceUUID,
    _charUuid: BluetoothCharacteristicUUID,
    value: DataView
  ): Array<StringKeyedObject> {
    const msg = textDecoder.decode(value.buffer);
    return [{ msg }];
  }
}

class PicoTempSensor_Driver extends BleDeviceDriver {
  canProvide(spec: BrowserDeviceSpecifier) {
    // TODO: Do this properly.  Once decided what format spec can take.
    return spec === "Pico Temp";
  }

  canHandleDevice(
    device: BluetoothDevice,
    specifier: BrowserDeviceSpecifier
  ): boolean {
    const name = device.name ?? "";
    return name.startsWith("Pico ");
  }

  deviceClass() {
    return PicoTempSensor_Device;
  }

  // TODO: Do we need to be this general?  Will we ever want to receive
  // value notifications for characteristics from more than one service?
  // Will we ever want to connect to more than one service?
  handledCharacteristics(): Array<ScopedCharacteristics> {
    return [{ serviceUuid: 0x181a, charUuids: [0x2a6e] }];
  }
}

export function register(manager: BrowserDeviceManager) {
  manager.registerDriver(new PicoTempSensor_Driver());
}
