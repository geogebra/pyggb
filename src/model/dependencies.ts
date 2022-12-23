import { action, Action, computed, Computed, thunk, Thunk } from "easy-peasy";
import { PyGgbModel } from ".";
import { GgbApi } from "../shared/ggb-interaction";
import { SkulptGgbModuleUrl } from "../shared/resources";
import { db } from "../shared/db";

type BootStatus = "idle" | "running" | "done";

export type Dependencies = {
  bootStatus: BootStatus;
  ggbApi: GgbApi;
  ggbPythonModuleText: string;

  allReady: Computed<Dependencies, boolean>;

  setBootStatus: Action<Dependencies, BootStatus>;
  setGgbApi: Action<Dependencies, GgbApi>;
  setGgbPythonModuleText: Action<Dependencies, string>;

  boot: Thunk<Dependencies, void, {}, PyGgbModel>;
};

export const dependencies: Dependencies = {
  bootStatus: "idle",
  ggbApi: null,
  ggbPythonModuleText: "",

  allReady: computed((s) => s.ggbApi !== null && s.ggbPythonModuleText !== ""),

  setBootStatus: action((s, status) => {
    s.bootStatus = status;
  }),
  setGgbApi: action((s, api) => {
    s.ggbApi = api;
  }),
  setGgbPythonModuleText: action((s, moduleText) => {
    s.ggbPythonModuleText = moduleText;
  }),

  boot: thunk(async (a, _voidPayload, helpers) => {
    const status = helpers.getState().bootStatus;
    if (status !== "idle") return;

    a.setBootStatus("running");

    const response = await fetch(SkulptGgbModuleUrl);
    const text = await response.text();
    a.setGgbPythonModuleText(text);

    await db.ensureUserFilesNonEmpty();

    a.setBootStatus("done");
  }),
};
