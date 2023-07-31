/** A session for obtaining leases on browser devices. */
class BrowserDeviceSession {
    constructor(displayName, manager, sessionId) {
        this.displayName = displayName;
        this.manager = manager;
        this.sessionId = sessionId;
        this.isClosed = false;
    }
    /** Try to obtain a lease on a device matching the given `specifier`
     * and, if successful, make it part of `this`. */
    async tryProvideLease(specifier) {
        if (this.isClosed)
            throw this.sessionClosedError("tryProvideLease");
        return await this.manager.tryProvideLease(this, specifier);
    }
    /** Close all leases contained within `this`. */
    close() {
        if (!this.isClosed) {
            this.manager.closeSessionLeases(this.sessionId);
            this.isClosed = true;
        }
    }
    /** (Internal use.)  Find which `PeripheralSession` (if any) has a
     * lease on the given browser device.  Return that session's ID if
     * there is such a session, else `null`. */
    leaseHolder(device) {
        if (this.isClosed)
            throw this.sessionClosedError("leaseHolder");
        return this.manager.leaseHolder(device);
    }
    sessionClosedError(methodName) {
        return new Error(`BrowserDeviceSession.${methodName}(): session is closed`);
    }
}

/** Has collection of `BrowserDeviceDriver`s, each of which knows how to
 * communicate with one particular kind of device.  Maintains collection
 * of `BrowserDeviceSession`s, which clients use to request access to
 * devices.  A webapp should have just one global instance of
 * `BrowserDeviceManager`, and unless there is a good reason to do
 * otherwise, the function `createPeripheralsManager` should be used to
 * create this one instance. */
class BrowserDeviceManager {
    /** (Internal use.)  Find which `PeripheralSession` (if any) has a
     * lease on the given browser device.  Return that session's ID if
     * there is such a session, else `null`. */
    leaseHolder(device) {
        var _a;
        const lease = this.leases.find((sl) => sl.handledDevice.browserDevice() === device);
        // Convert undefined to null:
        return (_a = lease === null || lease === void 0 ? void 0 : lease.session.sessionId) !== null && _a !== void 0 ? _a : null;
    }
    /** (Internal use.) */
    constructor() {
        this.lastSessionId_ = 4500;
        this.drivers = [];
        this.leases = [];
    }
    /** Register the given `driver` with `this`, such that requests for a
     * session to open a particular device will be passed to `driver` for
     * consideration. */
    registerDriver(driver) {
        this.drivers.push(driver);
    }
    /** Create and return a new `BrowserDeviceSession` with the given
     * `displayName`. */
    createSession(displayName) {
        return new BrowserDeviceSession(displayName, this, this.nextSessionId());
    }
    /** (Internal use.)  Close all leases belonging to the
     * `BrowserDeviceSession` with the given `sessionId`. */
    closeSessionLeases(sessionId) {
        let otherLeases = [];
        for (let lease of this.leases) {
            if (lease.session.sessionId === sessionId) {
                console.log("closing lease", lease.handledDevice);
                lease.handledDevice.close();
            }
            else {
                otherLeases.push(lease);
            }
        }
        this.leases = otherLeases;
    }
    /** (Internal use by `BrowserDeviceSession` instances.)  Try to obtain
     * a handled device matching the given `specifier`.  If successful,
     * create a lease on that device belonging to the given
     * `requestingSession`, and return (a `Promise` resolving to) the
     * handled device.  If unsuccessful, return (a `Promise` resolving to)
     * `null`. */
    async tryProvideLease(requestingSession, specifier) {
        // Do we need to worry about more than one driver being able to
        // provide a device for a particular specifier?  Which driver wins?
        let handledDevice = null;
        for (const driver of this.drivers) {
            console.log("tryProvideLease(): trying driver", driver);
            const maybeHandledDevice = await driver.tryProvideDevice(this, specifier);
            if (maybeHandledDevice != null) {
                handledDevice = maybeHandledDevice;
                break;
            }
        }
        if (handledDevice == null) {
            // TODO: Throw error?  Or is it the client's job to decide what to
            // do if we couldn't provide a suitable device?
            return null;
        }
        // Shouldn't happen:
        if (this.leaseHolder(handledDevice.browserDevice()) != null) {
            throw new Error("already leased");
        }
        const newLease = new SessionDeviceLease(requestingSession, handledDevice);
        this.leases.push(newLease);
        return handledDevice;
    }
    /** (Internal use.)  Create and return a new `SessionId`. */
    nextSessionId() {
        return ++this.lastSessionId_;
    }
}
/** A lease, part of a particular `session`, on a particular
 * `handledDevice`.  That session has exclusive use of the device until
 * it closes the lease (which is normally done when the whole session is
 * closed). */
class SessionDeviceLease {
    constructor(session, handledDevice) {
        this.session = session;
        this.handledDevice = handledDevice;
    }
}

// TODO: Rename to "driver-base-classes.ts"?
/** Abstract base class for device-drivers for hardware devices which
 * can be accessed from the browser. */
class BrowserDeviceDriver {
    /** (Must be implemented by subclass.)  Attempt to provide a handled
     * device satisfying the given `specifier`.  The given `manager` is
     * available to answer questions about whether a particular candidate
     * device is already being leased. */
    tryProvideDevice(_manager, _specifier) {
        throw new Error("BrowserDeviceDriver.tryProvideDevice(): not implemented");
    }
}

/** One actual concrete device owned and opened by the manager and
 * leased (or about to be leased) to some Session. */
class BrowserHandledDevice {
    constructor() {
        this.reports = [];
        this.eventListenerAbortController = new AbortController();
        this.isClosed = false;
    }
    /** (Must be overridden by subclass.)  Act on the given command from
     * the user. */
    async acceptCommand(_cmd) {
        throw this._notImplementedError("acceptCommand");
    }
    /** (Must be overridden by subclass.)  Tell the browser we have
     * finished with this device. */
    closeBrowserDevice() {
        throw this._notImplementedError("closeBrowserDevice");
    }
    // Is this internal use?
    //
    /** (Must be overridden by subclass.)  Return the actual in-browser
     * device object, which can be of various types.  The only requirement
     * is that they can be compared for identity (`===`), both within and
     * across types.  (We assume that device objects of different
     * substrates (e.g., a SerialPort and a BluetoothDevice) never have
     * the same identity.) */
    browserDevice() {
        throw this._notImplementedError("browserDevice");
    }
    /** (Internal use.)  Collect the given `reports` into `this.reports`,
     * adding a `timestamp` property to each one. */
    enqueueReports(reports) {
        // Divide by 1000 to get "seconds since epoch".
        const timestamp = Date.now() * 1.0e-3;
        for (const report of reports) {
            this.reports.push({ timestamp, ...report });
        }
    }
    /** Return an array of all the reports which have been received from
     * this device since the last time `drainReports()` was called.  (Or,
     * for the very first call to `drainReports()` on a particular device,
     * all the reports that have been received since that device was
     * opened.)
     * */
    drainReports() {
        const reports = this.reports;
        this.reports = [];
        return reports;
    }
    /** Stop listening for events from this device, and "close" it.
     * (Whatever "close" means for the particular device.) */
    close() {
        // TODO: Or is it an error to close an already-closed device?
        if (!this.isClosed) {
            this.eventListenerAbortController.abort();
            this.closeBrowserDevice();
            this.isClosed = true;
        }
    }
    _notImplementedError(methodName) {
        return new Error(`BrowserHandledDevice.${methodName}(): not implemented`);
    }
}

// Subtypes:
//
// HidDeviceDriver : BrowserDeviceDriver
// HidHandledDevice : BrowserHandledDevice
//
// Concrete HID device drivers must implemented subclasses of those.
class HidHandledDevice extends BrowserHandledDevice {
    // Private use only:
    constructor(device_) {
        super();
        this.device_ = device_;
    }
    browserDevice() {
        return this.device_;
    }
    closeBrowserDevice() {
        this.device_.close();
    }
    ////////////////////////////////////////////////////////////////////////
    // Concrete HID device implementations must implement the following.
    //
    acceptInputReport(_event) {
        throw new Error("HidHandledDevice.acceptInputReport(): not implemented");
    }
}
class HidDeviceDriver extends BrowserDeviceDriver {
    ////////////////////////////////////////////////////////////////////////
    // Concrete HID device drivers must implement the following.
    //
    /** Can this device driver, in general, supply a device meeting the
     * given specifier?  This question is independent of whether there is
     * any such device actually connected right now. */
    canProvide(_specifier) {
        throw this._notImplementedError("canProvide");
    }
    //
    /** Can this device driver handle the given device?  The specifier is
     * also provided in case it makes a difference to the answer. */
    canHandleDevice(_device, _specifier) {
        throw this._notImplementedError("canHandleDevice");
    }
    //
    /** What filters (for `requestDevice()`) should be used when asking
     * the user to approve a device for handling by this driver? */
    filtersFromSpecifier(_specifier) {
        throw this._notImplementedError("filtersFromSpecifier");
    }
    //
    /** What JavaScript class should be used to create a "handled device"
     * instance under this driver? */
    deviceClass() {
        throw this._notImplementedError("deviceClass");
    }
    ////////////////////////////////////////////////////////////////////////
    /** (Internal use.)  Construct a handled-HID-device for the given raw
     * HID device. */
    async createHandledDevice(device) {
        const deviceClass = this.deviceClass();
        const handledDevice = new deviceClass(device);
        await this.connectInputReportListener(handledDevice);
        return handledDevice;
    }
    /** (Internal use.)  Construct a new event listener for HID input
     * reports which uses the given `handledDevice` to translate the input
     * report into an array of normalised objects. */
    newInputReportListener(handledDevice) {
        return (event) => {
            handledDevice.enqueueReports(handledDevice.acceptInputReport(event));
        };
    }
    /** (Internal use.)  Set up an event listener for the given
     * `handledDevice`. */
    async connectInputReportListener(handledDevice) {
        const device = handledDevice.browserDevice();
        await device.open();
        const listener = this.newInputReportListener(handledDevice);
        const abortSignal = handledDevice.eventListenerAbortController.signal;
        device.addEventListener("inputreport", listener, { signal: abortSignal });
    }
    /** Try to provide an HID Device satisfying the given specifier. */
    async tryProvideDevice(manager, specifier) {
        console.log("HID tryProvideDevice()", specifier);
        if (!this.canProvide(specifier)) {
            console.log("can't provide");
            return null;
        }
        const allPermittedDevices = await navigator.hid.getDevices();
        for (const device of allPermittedDevices) {
            const leaseHolder = manager.leaseHolder(device);
            console.log("device", device, "has leaseHolder", leaseHolder);
            if (leaseHolder != null) {
                // Not available; someone (maybe the requesting session, or
                // maybe another session) under this manager already has a
                // lease.
                continue;
            }
            if (!this.canHandleDevice(device, specifier)) {
                // Unsuitable device for this driver.
                continue;
            }
            try {
                return await this.createHandledDevice(device);
            }
            catch (e) {
                console.log("failed to construct handled device", e);
                return null;
            }
        }
        // If we get here, none of the previously-permitted devices is
        // suitable.  Ask the user to choose and permit another one.
        const filters = this.filtersFromSpecifier(specifier);
        const grantedDevices = await navigator.hid.requestDevice({ filters });
        // TODO: Do we ever get more than one device back?
        const rawDevice = grantedDevices[0];
        // Perhaps the filters let through a device which we can't handle
        // after all.  (Maybe our filter asks for "any joystick" but there
        // are some makes/models which are known to not work properly, so
        // we have to check vID/pID against a blocklist.)
        if (!this.canHandleDevice(rawDevice, specifier)) {
            // TODO: Should the return type for this method be
            // Ok(device) | Error(reason)?
            console.log("can't handle user-chosen device");
            return null;
        }
        console.log("working with rawDevice", rawDevice);
        if (rawDevice.opened) {
            console.log("user-chosen device already in use");
            return null;
        }
        try {
            // Can we do anything more useful if this fails?
            return this.createHandledDevice(rawDevice);
        }
        catch (e) {
            console.log("open of", rawDevice, "failed:", e);
        }
        return null;
    }
    _notImplementedError(methodName) {
        return new Error(`HidDeviceDriver.${methodName}(): not implemented`);
    }
}

var hid = /*#__PURE__*/Object.freeze({
    __proto__: null,
    HidDeviceDriver: HidDeviceDriver,
    HidHandledDevice: HidHandledDevice
});

class Attack3_Device extends HidHandledDevice {
    acceptInputReport(event) {
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
    canProvide(spec) {
        // TODO: Do this properly, once decided on spec format.
        return spec === "Attack III";
    }
    canHandleDevice(device, _specifier) {
        return device.vendorId === 0x046d && device.productId === 0xc214;
    }
    filtersFromSpecifier(_specifier) {
        return [{ vendorId: 0x046d, productId: 0xc214 }];
    }
    deviceClass() {
        return Attack3_Device;
    }
}
function register$2(manager) {
    manager.registerDriver(new Attack3_Driver());
}

// Subclasses:
//
// BleDeviceDriver : BrowserDeviceDriver
// BleHandledDevice : BrowserHandledDevice
//
// Concrete Bluetooth device drivers must implemented subclasses of
// those.
class BleHandledDevice extends BrowserHandledDevice {
    // Private use only:
    constructor(device_) {
        super();
        this.device_ = device_;
    }
    browserDevice() {
        return this.device_;
    }
    closeBrowserDevice() {
        var _a;
        // TODO: Can we do anything if no gatt?
        (_a = this.device_.gatt) === null || _a === void 0 ? void 0 : _a.disconnect();
    }
    ////////////////////////////////////////////////////////////////////////
    // Concrete device implementations must implement the following.
    //
    acceptCharacteristicValue(_serviceUuid, _charUuid, _value) {
        throw new Error("BleHandledDevice.acceptCharacteristicValue(): not implemented");
    }
}
class BleDeviceDriver {
    ////////////////////////////////////////////////////////////////////////
    // Concrete device drivers must implement the following.
    //
    canProvide(_specifier) {
        throw this._notImplementedError("canProvide");
    }
    //
    canHandleDevice(_device, _specifier) {
        throw this._notImplementedError("deviceCanBeHandled");
    }
    //
    deviceClass() {
        throw this._notImplementedError("deviceClass");
    }
    //
    handledCharacteristics() {
        throw this._notImplementedError("handledCharacteristics");
    }
    ////////////////////////////////////////////////////////////////////////
    /** Compute and return an array holding the service-Uuids which this
     * device is interested in.  TODO: Is this nested structure the best
     * way to represent this?  Keep it simpler for v1 and have just one
     * service-Uuid having an array of char-Uuids? */
    handledServiceUuids() {
        console.log("handledServices()", this, this.handledCharacteristics);
        // Use set in case some services appear more than once.
        const serviceUuids = new Set(this.handledCharacteristics().map((x) => x.serviceUuid));
        return Array.from(serviceUuids);
    }
    /** Construct a new event listener for the given characteristic under
     * the given service on the given device.  The listener uses the
     * `handledDevice` to translate the characteristic value into an array
     * of normalised objects. */
    newCharValueListener(handledDevice, serviceUuid, charUuid) {
        console.log("constructing event listener for ble-device", handledDevice);
        return (event) => {
            console.log("driver listener", event);
            if (event.target == null) {
                return;
            }
            const target = event.target;
            if (target.value == null) {
                return;
            }
            handledDevice.enqueueReports(handledDevice.acceptCharacteristicValue(serviceUuid, charUuid, target.value));
        };
    }
    /** Set up listeners for updates of all characteristic values of
     * interest to the given `device`.  */
    async connectCharacteristicValueListeners(handledDevice) {
        var _a;
        const device = handledDevice.browserDevice();
        const server = await ((_a = device.gatt) === null || _a === void 0 ? void 0 : _a.connect());
        if (server == null) {
            throw new Error("BleDeviceDriver(): could not connect to gatt");
        }
        const abortSignal = handledDevice.eventListenerAbortController.signal;
        for (const { serviceUuid, charUuids } of this.handledCharacteristics()) {
            // TODO: Check what error we get if the device doesn't offer this
            // service.  This really shouldn't happen, because we included
            // these services as a filter in our requestDevice() call.
            const service = await server.getPrimaryService(serviceUuid);
            console.log("got service", service, "for", serviceUuid);
            for (const charUuid of charUuids) {
                // TODO: Where should we handle the NotFoundError which gets
                // thrown if the service does not have this characteristic?
                const characteristic = await service.getCharacteristic(charUuid);
                console.log("got char", characteristic, "for", charUuid);
                const listener = this.newCharValueListener(handledDevice, serviceUuid, charUuid);
                // After quite a bit of experimentation, the evidence is quite
                // strong that different event listeners can usually not be
                // added while notifications are running.  It seems that
                // sometimes just waiting a while lets you add an event listener
                // but not always.
                // TODO: Work out if there's something better we can do with
                // signal.  TypeScript thinks there is no overload of
                // addEventListener("characteristicvaluechanged", ...) which
                // takes an options arg.
                abortSignal.addEventListener("abort", () => characteristic.removeEventListener("characteristicvaluechanged", listener));
                await characteristic.stopNotifications();
                characteristic.addEventListener("characteristicvaluechanged", listener);
                await characteristic.startNotifications();
            }
        }
    }
    /** (Internal use.)  Construct a handled-BLE-device for the given raw
     * bluetooth device. */
    async createHandledDevice(device) {
        const deviceClass = this.deviceClass();
        const handledDevice = new deviceClass(device);
        await this.connectCharacteristicValueListeners(handledDevice);
        return handledDevice;
    }
    async tryProvideDevice(manager, specifier) {
        console.log("BLE tryProvideDevice()", specifier);
        if (!this.canProvide(specifier)) {
            console.log("can't provide");
            return null;
        }
        // TODO: Query navigator.bluetooth.getDevices() and see if there's
        // one in there which satisfies the specifier and we can connect to.
        const allPermittedDevices = await navigator.bluetooth.getDevices();
        for (const device of allPermittedDevices) {
            const leaseHolder = manager.leaseHolder(device);
            console.log("device", device, "has leaseHolder", leaseHolder);
            if (leaseHolder != null) {
                // Not available; someone (maybe the requesting session, or
                // maybe another session) under this manager already has a
                // lease.
                continue;
            }
            if (!this.canHandleDevice(device, specifier)) {
                // Unsuitable device for this driver.
                continue;
            }
            try {
                // TODO: This needs more work.  Will have to test whether the
                // device is actually in range right now.  Might have to do two
                // passes through the list.  One to collect all suitable
                // devices, then a second phase which listens for advertisements
                // for those devices and gives back the first one which
                // announces itself.
                return await this.createHandledDevice(device);
            }
            catch (e) {
                console.log("failed to construct handled device", e);
                return null;
            }
        }
        while (true) {
            console.log("attempting requestDevice()");
            const rawDevice = await navigator.bluetooth.requestDevice({
                filters: [{ services: this.handledServiceUuids() }],
            });
            console.log("working with rawDevice", rawDevice);
            // TODO: Is this the right test for "this device is in use?"
            if (rawDevice.gatt && !rawDevice.gatt.connected) {
                console.log("============= returning available rawDevice", rawDevice);
                return await this.createHandledDevice(rawDevice);
            }
            // Someone else has the device open.
            return null;
        }
    }
    _notImplementedError(methodName) {
        return new Error(`BleDeviceDriver.${methodName}(): not implemented`);
    }
}

var ble = /*#__PURE__*/Object.freeze({
    __proto__: null,
    BleDeviceDriver: BleDeviceDriver,
    BleHandledDevice: BleHandledDevice
});

const textDecoder = new TextDecoder();
class PicoTempSensor_Device extends BleHandledDevice {
    acceptCharacteristicValue(_serviceUuid, _charUuid, value) {
        const msg = textDecoder.decode(value.buffer);
        return [{ msg }];
    }
}
class PicoTempSensor_Driver extends BleDeviceDriver {
    canProvide(spec) {
        // TODO: Do this properly.  Once decided what format spec can take.
        return spec === "Pico Temp";
    }
    deviceClass() {
        return PicoTempSensor_Device;
    }
    // TODO: Do we need to be this general?  Will we ever want to receive
    // value notifications for characteristics from more than one service?
    // Will we ever want to connect to more than one service?
    handledCharacteristics() {
        return [{ serviceUuid: 0x181a, charUuids: [0x2a6e] }];
    }
}
function register$1(manager) {
    manager.registerDriver(new PicoTempSensor_Driver());
}

class MantaMM812_Device extends HidHandledDevice {
    acceptInputReport(event) {
        const x = event.data.getUint8(0);
        const y = event.data.getUint8(1);
        return [{ x, y }];
    }
}
class MantaMM812_Driver extends HidDeviceDriver {
    canProvide(specifier) {
        return specifier === "gamepad";
    }
    canHandleDevice(device, _specifier) {
        return device.vendorId === 0x081f && device.productId === 0xe401;
    }
    filtersFromSpecifier(_specifier) {
        return [{ vendorId: 0x081f, productId: 0xe401 }];
    }
    deviceClass() {
        return MantaMM812_Device;
    }
}
function register(manager) {
    manager.registerDriver(new MantaMM812_Driver());
}

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

var index = /*#__PURE__*/Object.freeze({
    __proto__: null,
    ble: ble,
    hid: hid
});

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
function createBrowserDeviceManager() {
    let manager = new BrowserDeviceManager();
    register$2(manager);
    register$1(manager);
    register(manager);
    return manager;
}

export { createBrowserDeviceManager, index as substrates };
