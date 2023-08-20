import { BrowserDeviceSpecifier, StringKeyedObject } from "../core-types";
import { BrowserDeviceManager } from "../manager";
import {
  BleDeviceDriver,
  BleHandledDevice,
  ScopedCharacteristics,
} from "../substrates/ble";

// TODO: Use these?
//
// const MESSAGE_GET_BATTERY_LEVEL = 3;
// const MESSAGE_GET_DIE_COLOR = 23;
// const MESSAGE_FLASH_LED = 16;
// const MESSAGE_SET_LED_COLORS = 8;

const EVENT_BATTERY_LEVEL = 0x42;
const EVENT_DIE_COLOR = 0x43;
const EVENT_CHARGING_START_END = 0x68;
const EVENT_ROLL_STARTED = 0x52;
const EVENT_ROLL_FINISHED = 0x53;

const diceColors = ["Black", "Red", "Green", "Blue", "Yellow", "Orange"];

/** Possible sorts of roll. */
const rollTypeLUT: Map<number, string> = (() => {
  let lut = new Map<number, string>();
  lut.set(0, "Regular roll"); // value 0 not explicitly returned, set in code
  lut.set(0x46, "fake placed");
  lut.set(0x4d, "placed");
  lut.set(0x54, "tilted?");
  return lut;
})();

class Vector3 {
  x: number;
  y: number;
  z: number;

  constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  static dot(v1: Vector3, v2: Vector3) {
    return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  }

  normalize() {
    const length = Math.sqrt(
      this.x * this.x + this.y * this.y + this.z * this.z
    );

    if (length > 0) {
      this.x /= length;
      this.y /= length;
      this.z /= length;
    }
  }
}

/** Vectors for D6.  Should be normalized. */
const vectorsD6 = [
  new Vector3(-1, 0, 0),
  new Vector3(0, 0, 1),
  new Vector3(0, 1, 0),
  new Vector3(0, -1, 0),
  new Vector3(0, 0, -1),
  new Vector3(1, 0, 0),
];

function getValue(x: number, y: number, z: number) {
  // TODO: handle different # of sides
  const vectors = vectorsD6;

  const diceThrow = new Vector3(x, y, z);
  diceThrow.normalize();

  let maxDot = -Infinity;
  let closestVectorIndex = -1;
  for (let i = 0; i < vectors.length; i++) {
    const dot = Vector3.dot(diceThrow, vectors[i]);
    if (dot > maxDot) {
      maxDot = dot;
      closestVectorIndex = i;
    }
  }

  return closestVectorIndex + 1;
}

class GoDice_Device extends BleHandledDevice {
  acceptCharacteristicValue(
    _serviceUuid: BluetoothServiceUUID,
    _charUuid: BluetoothCharacteristicUUID,
    value: DataView
  ): Array<StringKeyedObject> {
    console.log("GoDice", value);

    // ArrayBuffer
    const buff = value.buffer;

    // type of roll eg regular, placed
    let type = 0;

    let mode: number | undefined;
    let x: number | undefined;
    let y: number | undefined;
    let z: number | undefined;

    var len = buff.byteLength;

    switch (len) {
      case 1:
        mode = value.getUint8(0);
        break;
      case 4:
        mode = value.getUint8(0);
        x = value.getInt8(1);
        y = value.getInt8(2);
        z = value.getInt8(3);
        break;
      case 5:
        type = value.getUint8(0);
        mode = value.getUint8(1);
        x = value.getInt8(2);
        y = value.getInt8(3);
        z = value.getInt8(4);
        break;
      default:
        console.error("unhandled case: " + len + " bytes");
    }

    switch (mode) {
      case EVENT_BATTERY_LEVEL:
        // this event sent automatically when battery charging
        // as well as when requested with MESSAGE_GET_BATTERY_LEVEL
        return [{ batteryLevel: z }];
      case EVENT_DIE_COLOR:
        return [{ color: z == null ? "unknown" : diceColors[z] }];
      case EVENT_ROLL_STARTED:
        return [{ rollStarted: true }];
      case EVENT_ROLL_FINISHED: {
        const rolledValue =
          x != null && y != null && z != null ? getValue(x, y, z) : undefined;
        return [{ rolledValue, type: rollTypeLUT.get(type) }];
      }
      case EVENT_CHARGING_START_END:
        // [0x43, 0x68, 0x61, 0x72, 0x01] die is placed on charger
        // [0x43, 0x68, 0x61, 0x72, 0x00] die is removed fom charger
        const event = z === 1 ? "Placed on charger" : "Removed from charger";
        return [{ event }];
      default:
        // sends [0x43, 0x68, 0x61, 0x72, 0x00] sometimes
        // maybe charging started/ended?
        var message = ""; //"unknown message:";
        for (var i = 0; i < len; i++) {
          message += " 0x" + value.getUint8(i).toString(16);
        }
        return [{ unknownMessage: message }];
    }
  }
}

class GoDice_Driver extends BleDeviceDriver {
  canProvide(spec: BrowserDeviceSpecifier) {
    // TODO: Do this properly.  Once decided what format spec can take.
    return spec === "GoDice";
  }

  deviceClass() {
    return GoDice_Device;
  }

  canHandleDevice(
    device: BluetoothDevice,
    _specifier: BrowserDeviceSpecifier
  ): boolean {
    const name = device.name ?? "";
    return name.startsWith("GoDice_");
  }

  handledCharacteristics(): Array<ScopedCharacteristics> {
    return [
      {
        serviceUuid: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
        charUuids: [
          "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
          "6e400003-b5a3-f393-e0a9-e50e24dcca9e",
        ],
      },
    ];
  }

  // TODO: namePrefix() method
}

export function register(manager: BrowserDeviceManager) {
  manager.registerDriver(new GoDice_Driver());
}
