import { createBrowserDeviceManager } from "../../lib/browser-devices-manager";
import { BrowserDeviceSession } from "../../lib/browser-devices-manager/session";
import { DeviceLeaseChannel } from "../../lib/browser-devices-manager/device-lease-channel";
import { AppApi } from "../../shared/appApi";
import {
  SkObject,
  SkulptApi,
  augmentedSkulptApi,
} from "../../shared/vendor-types/skulptapi";

declare var Sk: SkulptApi;

let browserDevicesManager = createBrowserDeviceManager();
let liveBrowserDeviceSession: BrowserDeviceSession | null = null;

export function closeLiveSession() {
  liveBrowserDeviceSession?.close();
}

export function resetLiveSession() {
  closeLiveSession();
  const now = new Date().toISOString();
  console.log("resetLiveSession():", now);
  const name = `Session launched ${now}`;
  liveBrowserDeviceSession = browserDevicesManager.createSession(name);
}

interface SkDeviceLeaseChannel extends SkObject {
  lease: DeviceLeaseChannel;
}

export function register(mod: any, _appApi: AppApi) {
  const cls = Sk.abstr.buildNativeClass("DeviceLeaseChannel", {
    constructor: function SkDeviceLeaseChannel(
      this: SkDeviceLeaseChannel,
      lease: DeviceLeaseChannel
    ) {
      console.log("SkDeviceLeaseChannel(): lease", lease);
      this.lease = lease;
    },

    methods: {
      drain_reports: {
        $flags: { FastCall: true, NoArgs: true, NoKwArgs: true },
        $meth(this: SkDeviceLeaseChannel) {
          const reports = this.lease.drainReports();
          return Sk.ffi.remapToPy(reports);
        },
      },
    },
  });

  async function pyOpenDevice(pySpecifier: SkObject): Promise<SkObject> {
    if (!augmentedSkulptApi.checkString(pySpecifier)) {
      throw new Sk.builtin.TypeError("open_device() argument must be string");
    }
    if (liveBrowserDeviceSession == null) {
      throw new Sk.builtin.RuntimeError("no live session");
    }

    const specifier = pySpecifier.v;
    console.log("pyOpenDevice(): specifier", specifier);
    const lease = await liveBrowserDeviceSession.tryProvideLease(specifier);
    console.log("pyOpenDevice(): lease", lease);

    // TODO: Should we instead throw an error if we don't get the device
    // we asked for?
    return lease == null ? Sk.builtin.none.none$ : new cls(lease);
  }

  mod.open_device = new Sk.builtin.func((pySpecifier: SkObject) =>
    Sk.misceval.promiseToSuspension(pyOpenDevice(pySpecifier))
  );
}
