/** Any object whose keys are strings. */
export type StringKeyedObject = Record<string, any>;

/** Any object whose keys are strings and which has a `timestamp`
 * property. */
export type TimestampedReport = StringKeyedObject & { timestamp: number };

// The user should be able to say "get me a joystick" or "get me an Attack3".
export type BrowserDeviceSpecifier = string;
// What does this string look like?  Like "hid:usage=joystick"?  Or
// "hid:vid=12ab:pid=34cd"? "ble:heart-rate-measurement", "ble:0x180d"?

/** An opaque identifier for a particular browser-device session. */
export type SessionId = number;
