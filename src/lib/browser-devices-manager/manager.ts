import { BrowserDeviceSpecifier, SessionId } from "./core-types";
import { BrowserDeviceDriver } from "./driver-interfaces";
import { BrowserDeviceSession } from "./session";
import { BrowserHandledDevice } from "./substrates/common";
import { AnyPhysicalDevice } from "./substrates";

/** Has collection of `BrowserDeviceDriver`s, each of which knows how to
 * communicate with one particular kind of device.  Maintains collection
 * of `BrowserDeviceSession`s, which clients use to request access to
 * devices.  A webapp should have just one global instance of
 * `BrowserDeviceManager`, and unless there is a good reason to do
 * otherwise, the function `createPeripheralsManager` should be used to
 * create this one instance. */
export class BrowserDeviceManager {
  /** (Internal use.)  Find which `PeripheralSession` (if any) has a
   * lease on the given browser device.  Return that session's ID if
   * there is such a session, else `null`. */
  leaseHolder(device: AnyPhysicalDevice): SessionId | null {
    const lease = this.leases.find(
      (sl) => sl.handledDevice.browserDevice() === device
    );

    // Convert undefined to null:
    return lease?.session.sessionId ?? null;
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
  registerDriver(driver: BrowserDeviceDriver) {
    this.drivers.push(driver);
  }

  /** Create and return a new `BrowserDeviceSession` with the given
   * `displayName`. */
  createSession(displayName: string): BrowserDeviceSession {
    return new BrowserDeviceSession(displayName, this, this.nextSessionId());
  }

  /** (Internal use.)  Close all leases belonging to the
   * `BrowserDeviceSession` with the given `sessionId`. */
  closeSessionLeases(sessionId: number) {
    let otherLeases: Array<SessionDeviceLease> = [];
    for (let lease of this.leases) {
      if (lease.session.sessionId === sessionId) {
        console.log("closing lease", lease.handledDevice);
        lease.handledDevice.close();
      } else {
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
  async tryProvideLease(
    requestingSession: BrowserDeviceSession,
    specifier: BrowserDeviceSpecifier
  ): Promise<BrowserHandledDevice | null> {
    // Do we need to worry about more than one driver being able to
    // provide a device for a particular specifier?  Which driver wins?
    let handledDevice: BrowserHandledDevice | null = null;
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
  nextSessionId(): SessionId {
    return ++this.lastSessionId_;
  }

  lastSessionId_: SessionId;

  /** (Internal use.)  Array of `BrowserDeviceDriver` instances made
   * known to this via `register()`. */
  drivers: Array<BrowserDeviceDriver>;

  /** (Internal use.)  Array of `SessionDeviceLease` instances created
   * in response to successful calls to `tryProvideLease()`. */
  leases: Array<SessionDeviceLease>;
}

/** A lease, part of a particular `session`, on a particular
 * `handledDevice`.  That session has exclusive use of the device until
 * it closes the lease (which is normally done when the whole session is
 * closed). */
class SessionDeviceLease {
  constructor(
    readonly session: BrowserDeviceSession,
    readonly handledDevice: BrowserHandledDevice
  ) {}
}
