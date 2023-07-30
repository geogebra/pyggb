import { BrowserDeviceSpecifier, SessionId } from "./core-types";
import { BrowserDeviceManager } from "./manager";
import { DeviceLeaseChannel } from "./device-lease-channel";
import { AnyPhysicalDevice } from "./substrates";

/** A session for obtaining leases on browser devices. */
export class BrowserDeviceSession {
  constructor(
    readonly displayName: string,
    readonly manager: BrowserDeviceManager,
    readonly sessionId: SessionId
  ) {
    this.isClosed = false;
  }

  isClosed: boolean;

  /** Try to obtain a lease on a device matching the given `specifier`
   * and, if successful, make it part of `this`. */
  async tryProvideLease(
    specifier: BrowserDeviceSpecifier
  ): Promise<DeviceLeaseChannel | null> {
    if (this.isClosed) throw this.sessionClosedError("tryProvideLease");
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
  leaseHolder(device: AnyPhysicalDevice): SessionId | null {
    if (this.isClosed) throw this.sessionClosedError("leaseHolder");
    return this.manager.leaseHolder(device);
  }

  sessionClosedError(methodName: string) {
    return new Error(`BrowserDeviceSession.${methodName}(): session is closed`);
  }
}
