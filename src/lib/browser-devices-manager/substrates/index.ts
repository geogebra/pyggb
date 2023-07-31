export type AnyPhysicalDevice =
  | HIDDevice
  | BluetoothDevice
  | SerialPort
  | USBDevice;

export * as ble from "./ble";
export * as hid from "./hid";

// TODO: Not currently using SerialPort or USBDevice.

/** Terminology:
 *
 * A _Driver_ is an object which knows how to open and handle devices of
 * a particular kind.  For example, we might have a driver for the
 * "Logitech Attack III" joystick.
 *
 * A _HandledDevice_ is an object which is handling one particular
 * physical instance of that joystick-kind, connected to the machine the
 * webapp is running on.  For some device kinds, the handled-device will
 * need to maintain state, for example for a device connected over
 * serial where a complete message must be accumulate from multiple
 * fragments from the device before generating a report.
 *
 * Intermediate classes `HidHandledDevice` and `BleHandledDevice`
 * attempt to extract the common logic for dealing with devices
 * connected in that fashion (using that _substrate_).  So to write a
 * _Driver_ for, say, an HID device-kind, you need only write the logic
 * specific to that device-kind, and not the common logic about opening
 * the device, connecting event listeners, etc.
 */
