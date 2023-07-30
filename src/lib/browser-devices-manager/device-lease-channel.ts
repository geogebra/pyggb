import { StringKeyedObject } from "./core-types";

/** Idea here is that the client only really needs to interact with the
 * leased device by collecting information that the device has sent and
 * by sending the device commands.  And maybe by closing the lease.  Is
 * it worth abstracting like this? */
export interface DeviceLeaseChannel {
  acceptCommand(msg: StringKeyedObject): Promise<void>;
  drainReports(): Array<StringKeyedObject>;
  close(): void;
}
