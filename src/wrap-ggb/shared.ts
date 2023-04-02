import { SkulptApi, SkObject, SkInt, SkFloat, SkString } from "./skulptapi";
import { GgbApi } from "./ggbapi";
import { parseColorOrFail } from "./color";
import { wrapExistingGgbObject } from "./type-registry";
import { OperationSlots, operationSlots } from "./operations";

/** A Skulpt object which is also a wrapped GeoGebra object. */
export interface SkGgbObject extends SkObject {
  $ggbLabel: string;
  $updateHandlers: Array<any>;
  $fireUpdateEvents(...args: Array<any>): any;
}

declare var Sk: SkulptApi;

/** Spec to indicate that we should construct a new Skulpt/Python
 * wrapper for an existing GeoGebra object. */
export type WrapExistingCtorSpec = {
  kind: "wrap-existing";
  label: string;
};

/** Given a JavaScript number `x`, return a string representation of `x`
 * which GeoGebra will interpret correctly.  We don't want to feed
 * exponential notation in the form "4.1693084667370053e-38" directly to
 * GeoGebra.
 * */
export const strOfNumber = (x: number): string => {
  const jsStr = x.toExponential();
  const [sig, exp] = jsStr.split("e");
  return `(${sig}*10^(${exp}))`;
};

/** Given a Skulpt/PyGgb object `cls`, which should be a class object,
 * return a predicate function which tests whether a given Skulpt/PyGgb
 * object is (in the Python sense) an instance of that class.
 *
 * This is a two-step process to facilitate using, for example,
 * `isInstance(someClass)` as the predicate argument of an
 * `Array.every()` call. */
export const isInstance = (cls: SkObject) => (obj: SkObject) =>
  Sk.builtin.isinstance(obj, cls).v;

function _isGgbObject(obj: SkObject): obj is SkGgbObject {
  return "$ggbLabel" in obj;
}

/** Test whether the Skulpt/PyGgb object `obj` is an `SkGgbObject` of
 * the given GeoGebra type `requiredType` (for example, `"circle"`).  If
 * `requiredType` is omitted, test only whether `obj` is an
 * `SkGgbObject`.  The given `ggbApi` is used to get the object's
 * GeoGebra type.
 * */
export const isGgbObject = (
  ggbApi: GgbApi,
  obj: SkObject,
  requiredType?: string
): obj is SkGgbObject => {
  // Could collapse the following into one bool expression but it wouldn't
  // obviously be clearer.

  if (!_isGgbObject(obj)) return false;

  // It is a GGB object.  If we're not fussy about what type, we're done.
  if (requiredType == null) return true;

  // We are fussy about what type; compare.
  const gotType = ggbApi.getObjectType(obj.$ggbLabel);
  return gotType === requiredType;
};

/** Test whether every element of a (JavaScript) array is an
 * `SkGgbObject`.  This is provided explicitly (rather than letting
 * callers use `xs.every(⋯)` instead) to help TypeScript with its
 * type-narrowing. */
const everyElementIsGgbObject = (
  objs: Array<SkObject>
): objs is Array<SkGgbObject> => objs.every(_isGgbObject);

/** Test whether the Skulpt/PyGgb object `obj` is either a Skulpt/Python
 * number or a GeoGebra `numeric` object. */
export const isPythonOrGgbNumber = (ggbApi: GgbApi, obj: SkObject) =>
  Sk.builtin.checkNumber(obj) || isGgbObject(ggbApi, obj, "numeric");

/** Given a Skulpt/PyGgb object `x`, which should be either a `numeric`
 * GeoGebra object or a Python number, return a string suitable for
 * inclusion in a GeoGebra command.  For a `numeric` object, return its
 * label.  For a Python number, return a literal string representation.
 * */
export const numberValueOrLabel = (ggbApi: GgbApi, x: SkObject): string => {
  if (isGgbObject(ggbApi, x, "numeric")) {
    return x.$ggbLabel;
  }

  if (Sk.builtin.checkNumber(x)) {
    const jsStr = x.v.toExponential();
    const [sig, exp] = jsStr.split("e");
    return `(${sig}*10^(${exp}))`;
  }

  // TODO: Can we tighten types to avoid this runtime check?
  throw new Sk.builtin.RuntimeError("internal error: not Number or number");
};

/** Set the attributes in `propNamesValue` (typically Python properties)
 * on the given `obj`, and return `obj`.  The attribute/property names
 * (JavaScript strings) and values (`SkObject` instances) should
 * alternate in the `propNamesValues` array. */
export const withPropertiesFromNameValuePairs = (
  obj: SkObject,
  propNamesValues?: Array<string | SkObject>
) => {
  propNamesValues = propNamesValues ?? [];

  if (propNamesValues.length % 2 !== 0) {
    throw new Sk.builtin.RuntimeError(
      "internal error: propNamesValues not in pairs"
    );
  }

  for (let i = 0; i !== propNamesValues.length; i += 2) {
    // Not easy to tell TypeScript that the name/value pairs alternate
    // within the array, so help it:
    const propName = propNamesValues[i] as string;
    const propPyName = new Sk.builtin.str(propName);
    const propValue = propNamesValues[i + 1] as SkObject;
    obj.tp$setattr(propPyName, propValue);
  }

  return obj;
};

/** Assert that the given `obj` wraps a GeoGebra object.  If not, throw
 * a `TypeError` whose message uses the given `objName`.
 * */
function throwIfNotGgbObject(
  obj: SkObject,
  objName: string
): asserts obj is SkGgbObject {
  if (!_isGgbObject(obj)) {
    throw new Sk.builtin.TypeError(`${objName} must be a GeoGebra object`);
  }
}

/** Assert that the given `pyObj` is a Python string.  If not, throw a
 * `TypeError`, whose message uses the given `objName`. */
export function throwIfNotString(
  pyObj: SkObject,
  objName: string
): asserts pyObj is SkString {
  if (!Sk.builtin.checkString(pyObj))
    throw new Sk.builtin.TypeError(`${objName} must be a string`);
}

/** Assert that the given `pyObj` is a Python number.  If not, throw a
 * `TypeError`, whose message uses the given `objName`. */
export function throwIfNotNumber(
  pyObj: SkObject,
  objName: string
): asserts pyObj is SkInt | SkFloat {
  if (!Sk.builtin.checkNumber(pyObj))
    throw new Sk.builtin.TypeError(`${objName} must be a number`);
}

// The only type we use:
type FastCallMethod = (
  this: SkGgbObject,
  args: Array<SkObject>,
  kwargs: Array<string | SkObject>
) => SkObject;

type MethodDescriptor = {
  $flags: { [key: string]: boolean };
  $meth: FastCallMethod;
};

type MethodDescriptorsSlice = {
  [methodName: string]: MethodDescriptor;
};

/** Method descriptors slice defining the Python method
 * `with_properties()`.  Suitable for spreading into the `methods`
 * property of the options object passed to `buildNativeClass()`. */
const withPropertiesMethodsSlice: MethodDescriptorsSlice = {
  with_properties: {
    $flags: { FastCall: true },
    $meth(args, kwargs) {
      if (args.length !== 0) throw new Sk.builtin.TypeError("only kwargs");
      return withPropertiesFromNameValuePairs(this, kwargs);
    },
  },
};

/** Method descriptors slice defining the Python method `free_copy()`.
 * Suitable for spreading into the `methods` property of the options
 * object passed to `buildNativeClass()`. */
const freeCopyMethodsSlice = (ggbApi: GgbApi): MethodDescriptorsSlice => ({
  free_copy: {
    $flags: { NoArgs: true },
    $meth(this: SkGgbObject) {
      const ggbCmd = `CopyFreeObject(${this.$ggbLabel})`;
      const label = ggbApi.evalCommandGetLabels(ggbCmd);
      return wrapExistingGgbObject(ggbApi, label);
    },
  },
});

type ReadOnlyProperty = {
  $get(this: SkGgbObject): SkObject;
};
type ReadWriteProperty = ReadOnlyProperty & {
  $set(this: SkGgbObject, val: SkObject): void;
};

type SharedGetSets = {
  is_visible: ReadWriteProperty;
  is_independent: ReadOnlyProperty;
  color: ReadWriteProperty;
  size: ReadWriteProperty;
  line_thickness: ReadWriteProperty;
};

/** Construct and return an object which contains various common
 * property definitions, which use the given `ggbApi` for interaction
 * with GeoGebra.  The returned object is suitable for inclusion in the
 * `getsets` property of the options used in `buildNativeClass()`;
 * alternatively, a subset of its properties can be used like that. */
const sharedGetSets = (ggbApi: GgbApi): SharedGetSets => ({
  is_visible: {
    $get(this: SkGgbObject) {
      return new Sk.builtin.bool(ggbApi.getVisible(this.$ggbLabel));
    },
    $set(this: SkGgbObject, pyIsVisible: SkObject) {
      const isVisible = Sk.misceval.isTrue(pyIsVisible);
      ggbApi.setVisible(this.$ggbLabel, isVisible);
    },
  },
  is_independent: {
    $get(this: SkGgbObject) {
      return new Sk.builtin.bool(ggbApi.isIndependent(this.$ggbLabel));
    },
  },
  color: {
    $get(this: SkGgbObject) {
      const color = ggbApi.getColor(this.$ggbLabel);
      return new Sk.builtin.str(color);
    },
    $set(this: SkGgbObject, pyColor: SkObject) {
      throwIfNotString(pyColor, "color");
      const mRGB = parseColorOrFail(pyColor.v);
      ggbApi.setColor(this.$ggbLabel, ...mRGB);
    },
  },
  size: {
    $get(this: SkGgbObject) {
      return new Sk.builtin.float_(ggbApi.getPointSize(this.$ggbLabel));
    },
    $set(this: SkGgbObject, pySize: SkObject) {
      throwIfNotNumber(pySize, "size must be a number");
      // TODO: Verify integer and in range [1, 9]
      ggbApi.setPointSize(this.$ggbLabel, pySize.v);
    },
  },
  line_thickness: {
    $get(this: SkGgbObject) {
      return new Sk.builtin.int_(ggbApi.getLineThickness(this.$ggbLabel));
    },
    $set(this: SkGgbObject, pyThickness: SkObject) {
      throwIfNotNumber(pyThickness, "line_thickness must be a number");
      // TODO: Verify integer and in range [1, 13]
      ggbApi.setLineThickness(this.$ggbLabel, pyThickness.v);
    },
  },
});

export type AugmentedGgbApi = {
  isGgbObject(obj: SkObject): obj is SkGgbObject;
  everyElementIsGgbObject: typeof everyElementIsGgbObject;
  isPythonOrGgbNumber(obj: SkObject): boolean;
  numberValueOrLabel(obj: SkObject): string;
  wrapExistingGgbObject(label: string): SkGgbObject;
  sharedGetSets: SharedGetSets;
  freeCopyMethodsSlice: MethodDescriptorsSlice;
  withPropertiesMethodsSlice: MethodDescriptorsSlice;
  evalCmd(cmd: string): string;
  getValue(label: string): number;
  setValue(label: string, value: number): void;
  getXcoord(label: string): number;
  getYcoord(label: string): number;
  setCoords(label: string, x: number, y: number): void;
  deleteObject(label: string): void;
  registerObjectUpdateListener(label: string, fun: () => void): void;
  sharedOpSlots: OperationSlots;
};

/** Construct and return an "augmented GeoGebra API" object, which adds
 * various utility functions and constants to the native GeoGebra API.
 * */
export const augmentedGgbApi = (ggbApi: GgbApi): AugmentedGgbApi => {
  // Can we make this generic and variadic?
  function fixGgbArg_1<ArgT, ResultT>(
    f: (ggbApi: GgbApi, arg: ArgT) => ResultT
  ) {
    return (arg: ArgT) => f(ggbApi, arg);
  }

  const evalCmd = (cmd: string): string => ggbApi.evalCommandGetLabels(cmd);
  const getValue = (label: string): any => ggbApi.getValue(label);
  const setValue = (label: string, value: number): void =>
    ggbApi.setValue(label, value);
  const setCoords = (label: string, x: number, y: number): void =>
    ggbApi.setCoords(label, x, y);
  const getXcoord = (label: string): number => ggbApi.getXcoord(label);
  const getYcoord = (label: string): number => ggbApi.getYcoord(label);
  const deleteObject = (label: string): void => ggbApi.deleteObject(label);
  const registerObjectUpdateListener = (label: string, fun: () => void): void =>
    ggbApi.registerObjectUpdateListener(label, fun);

  // TypeScript can't (yet?) infer type predicate return values.
  type IsGgbObjectPredicate = (x: SkObject) => x is SkGgbObject;

  const api: AugmentedGgbApi = {
    isGgbObject: fixGgbArg_1(isGgbObject) as IsGgbObjectPredicate,
    everyElementIsGgbObject,
    isPythonOrGgbNumber: fixGgbArg_1(isPythonOrGgbNumber),
    numberValueOrLabel: fixGgbArg_1(numberValueOrLabel),
    wrapExistingGgbObject: fixGgbArg_1(wrapExistingGgbObject),
    sharedGetSets: sharedGetSets(ggbApi),
    freeCopyMethodsSlice: freeCopyMethodsSlice(ggbApi),
    withPropertiesMethodsSlice,
    evalCmd,
    getValue,
    setValue,
    getXcoord,
    getYcoord,
    setCoords,
    deleteObject,
    registerObjectUpdateListener,
    sharedOpSlots: operationSlots(ggbApi),
  };

  return api;
};
