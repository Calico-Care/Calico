declare module 'inherits' {
  type InheritsFn = (ctor: unknown, superCtor: unknown) => void;
  const inherits: InheritsFn;
  export = inherits;
}

declare module 'util' {
  const util: Record<string, unknown> & { inherits?: (...args: unknown[]) => void };
  export = util;
}
