import { BrowserDeviceManager } from "./manager";
import { register as registerLogitechAttackIII } from "./drivers/logitech-attack-iii";
import { register as registerPicoW } from "./drivers/pico-w-temp-sensor";
import { register as registerMantaMM812 } from "./drivers/manta-mm812";
import { register as registerDistoLengthSensor } from "./drivers/disto-length-sensor";
import { register as registerDualShock } from "./drivers/dual-shock";
import { register as registerGoDice } from "./drivers/go-dice";
import { register as registerWowweeMipRobot } from "./drivers/wowwee-mip-robot";

export type { BrowserDeviceSpecifier, StringKeyedObject } from "./core-types";
export * as substrates from "./substrates/index";

// TODO: The idea of the "specifier" needs more work.

// Need some clear terms to distinguish between
//
// The Logitech Attack 3 as a product ("SKU"?)
//
// This particular Logitech Attack 3, the one on the left out of the two
// I have sitting on my desk ("instance"?)

// Word for Hid vs generic Usb vs Serial vs Bluetooth?  "Substrate"?

// Optionally look up "specifier" in a map maintained by the manager?  So
// users can do something like requestDevice("Logitech Attack 3")? Some
// way to dump all the device-SKUs the manager knows about.  Could
// expose this to end-user either through the app UI or in Python-land.

// ----OR----

// For a device connected over serial, we don't care so much who made
// the USB serial adapter; we care about what's the other end of the
// serial link.  How are we going to say that?  For many (all?) of these
// situations, might be OK to just leave that up to the user, to choose
// the right serial port from the list which pops up.

/** Create a new `BrowserDeviceManager` with the known device drivers
 * already registered. */
export function createBrowserDeviceManager(): BrowserDeviceManager {
  let manager = new BrowserDeviceManager();

  registerLogitechAttackIII(manager);
  registerPicoW(manager);
  registerMantaMM812(manager);
  registerDistoLengthSensor(manager);
  registerDualShock(manager);
  registerGoDice(manager);
  registerWowweeMipRobot(manager);

  return manager;
}
