type NextTickCallback = (...args: unknown[]) => void;
type NextTickFn = (callback: NextTickCallback, ...args: unknown[]) => void;

const getProcess = (): { nextTick?: NextTickFn } => {
  const current = (globalThis as { process?: { nextTick?: NextTickFn } }).process;
  return current ?? {};
};

/**
 * Centralized error handler for process.nextTick callback errors.
 * Rethrows errors asynchronously to preserve async error behavior and prevent
 * unhandled rejection warnings.
 */
function handleCallbackError(error: unknown): void {
  // Rethrow asynchronously to maintain error propagation behavior
  // This ensures errors don't get swallowed and maintain proper async semantics
  setTimeout(() => {
    throw error;
  }, 0);
}

/**
 * Safely invokes a callback with error handling.
 * Wraps callback execution in try-catch to ensure errors are consistently handled.
 */
const invokeLater = (callback: NextTickCallback, args: unknown[]): void => {
  try {
    callback(...args);
  } catch (error) {
    handleCallbackError(error);
  }
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
      Promise.resolve()
        .then(() => {
          invokeLater(callback, args);
        })
        .catch((error) => {
          // Forward promise rejection errors to the same centralized handler
          handleCallbackError(error);
        });
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
