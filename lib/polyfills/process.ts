type NextTickCallback = (...args: unknown[]) => void;
type NextTickFn = (callback: NextTickCallback, ...args: unknown[]) => void;

const getProcess = (): { nextTick?: NextTickFn } => {
  const current = (globalThis as { process?: { nextTick?: NextTickFn } }).process;
  return current ?? {};
};

const invokeLater = (callback: NextTickCallback, args: unknown[]): void => {
  callback(...args);
};

const createNextTick = (): NextTickFn => {
  if (typeof queueMicrotask === 'function') {
    return (callback, ...args) => {
      queueMicrotask(() => {
        invokeLater(callback, args);
      });
    };
  }

  if (typeof Promise === 'function') {
    return (callback, ...args) => {
      Promise.resolve().then(
        () => {
          invokeLater(callback, args);
        },
        () => {
          // no-op; suppress unhandled rejection warnings when callback throws
        }
      );
    };
  }

  return (callback, ...args) => {
    setTimeout(() => {
      invokeLater(callback, args);
    }, 0);
  };
};

const globalProcess = getProcess();

if (typeof globalProcess.nextTick !== 'function') {
  Object.defineProperty(globalProcess, 'nextTick', {
    value: createNextTick(),
    configurable: true,
    writable: true,
  });
}

(globalThis as { process: typeof globalProcess }).process = globalProcess;
