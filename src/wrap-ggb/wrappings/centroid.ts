import { AppApi } from "../../shared/appApi";
import { augmentedGgbApi, AugmentedGgbApi } from "../shared";
import { SkulptApi } from "../../shared/vendor-types/skulptapi";

declare var Sk: SkulptApi;

export const register = (mod: any, appApi: AppApi) => {
  const ggb: AugmentedGgbApi = augmentedGgbApi(appApi.ggb);

  const fun = new Sk.builtin.func((...args) => {
    const badArgsError = new Sk.builtin.TypeError(
      "Centroid() arguments must be (polygon)"
    );

    switch (args.length) {
      case 1: {
        if (!ggb.everyElementIsGgbObjectOfType(args, "polygon")) {
          throw badArgsError;
        }

        const ggbCmd = `Centroid(${args[0].$ggbLabel})`;
        const label = ggb.evalCmd(ggbCmd);
        return ggb.wrapExistingGgbObject(label);
      }
      default:
        throw badArgsError;
    }
  });

  mod.Centroid = fun;
};
