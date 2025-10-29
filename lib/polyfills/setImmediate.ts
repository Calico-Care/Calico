type ImmediateHandle = number;
type ImmediateCallback = (...args: unknown[]) => void;

const globalScope = globalThis as typeof globalThis & {
  setImmediate?: ((callback: ImmediateCallback, ...args: unknown[]) => ImmediateHandle) & {
    __promisify__?: unknown;
  };
  clearImmediate?: (handle: ImmediateHandle) => void;
};

if (typeof globalScope.setImmediate !== 'function') {
  let nextHandle = 1;
  const tasks = new Map<ImmediateHandle, { callback: ImmediateCallback; args: unknown[] }>();

  const runTask = (handle: ImmediateHandle): void => {
    const task = tasks.get(handle);
    if (!task) {
      return;
    }
    tasks.delete(handle);
    task.callback(...task.args);
  };

  const installSchedulingMechanism = (): ((handle: ImmediateHandle) => void) => {
    if (typeof queueMicrotask === 'function') {
      return (handle) => {
        queueMicrotask(() => {
          runTask(handle);
        });
      };
    }

    if (typeof MessageChannel === 'function') {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        runTask(event.data as ImmediateHandle);
      };
      return (handle) => {
        channel.port2.postMessage(handle);
      };
    }

    return (handle) => {
      setTimeout(() => {
        runTask(handle);
      }, 0);
    };
  };

  const schedule = installSchedulingMechanism();

  globalScope.setImmediate = ((callback: ImmediateCallback, ...args: unknown[]) => {
    const handle = nextHandle++;
    tasks.set(handle, { callback, args });
    schedule(handle);
    return handle;
  }) as typeof globalScope.setImmediate;

  globalScope.clearImmediate = ((handle: ImmediateHandle) => {
    tasks.delete(handle);
  }) as typeof globalScope.clearImmediate;
}
