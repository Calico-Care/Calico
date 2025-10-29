import inheritsModule from 'inherits';

type InheritsFn = (ctor: unknown, superCtor: unknown) => void;

const resolvedInherits: InheritsFn =
  typeof inheritsModule === 'function'
    ? inheritsModule
    : // Some bundlers wrap CommonJS default exports in a `default` property.
      (inheritsModule as { default: InheritsFn }).default;

let utilModule: { inherits?: InheritsFn };

try {
  utilModule = (require('node:util') ?? {}) as { inherits?: InheritsFn };
} catch {
  utilModule = {};
}

if (typeof utilModule.inherits !== 'function') {
  Object.defineProperty(utilModule, 'inherits', {
    value: resolvedInherits,
    configurable: true,
    writable: true,
  });
}
