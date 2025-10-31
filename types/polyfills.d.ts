declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- ambient declaration
  interface ProcessShim {
    nextTick?: (callback: (...args: unknown[]) => void, ...args: unknown[]) => void;
    env?: Record<string, string | undefined>;
    [key: string]: unknown;
  }

  var process: ProcessShim | undefined;
  function require(name: string): unknown;
  function setImmediate(callback: (...args: unknown[]) => void, ...args: unknown[]): number;
  function clearImmediate(handle: number): void;
}

export {};
