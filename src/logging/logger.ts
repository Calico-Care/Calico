import { logger as ReactNativeLogger, type transportFunctionType } from 'react-native-logs';
import type { Logger as WinstonLogger, LoggerOptions as WinstonLoggerOptions } from 'winston';

import { redact } from './redact';

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';
type Channel = 'app' | 'audit';

type LoggerMethod = (event: string, ...details: unknown[]) => void;

interface LoggerFacade {
  debug: LoggerMethod;
  info: LoggerMethod;
  warn: LoggerMethod;
  error: LoggerMethod;
  setLevel(level: LogLevel): void;
  addMeta(meta: Record<string, unknown>): void;
  child(namespace: string, meta?: Record<string, unknown>): LoggerFacade;
  audit(event: string, details?: Record<string, unknown>): void;
}

interface CreateLoggerOptions {
  level?: LogLevel;
  channel?: Channel;
  namespace?: string;
  meta?: Record<string, unknown>;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  channel: Channel;
  event: string;
  namespace?: string;
  context?: Record<string, unknown>;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

interface RuntimeWriter {
  write(level: LogLevel, entry: LogEntry, serialised: string): void;
  setLevel(level: LogLevel): void;
}

interface RuntimeState {
  writer: RuntimeWriter;
  channel: Channel;
  level: LogLevel;
}

interface NormalisedArgs {
  error?: Error;
  data?: Record<string, unknown>;
}

type BreadcrumbLevel = 'debug' | 'info';

type SentryModule = typeof import('@sentry/react-native');

const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

const MAX_PAYLOAD_BYTES = 10 * 1024;
const BREADCRUMB_CHUNK_BYTES = 2048;
const AUDIT_BUFFER_LIMIT = 200;

const auditBuffer: LogEntry[] = [];

const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';

const safeGlobalConsole = console;

let Sentry: SentryModule | undefined;
try {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  Sentry = require('@sentry/react-native') as SentryModule;
} catch {
  Sentry = undefined;
}

const dynamicRequire: NodeRequire | undefined = (() => {
  if (!isReactNative && typeof require !== 'undefined') {
    try {
      // biome-ignore lint/security/noGlobalEval: Used to avoid bundling winston in React Native builds.
      return eval('require');
    } catch {
      return undefined;
    }
  }
  return undefined;
})();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function normaliseArgs(args: unknown[]): NormalisedArgs {
  if (!args.length) {
    return {};
  }

  const result: NormalisedArgs = {};

  args.forEach((arg) => {
    if (!result.error && arg instanceof Error) {
      result.error = arg;
      return;
    }

    if (isPlainObject(arg)) {
      result.data = {
        ...(result.data ?? {}),
        ...arg,
      };
    }
  });

  return result;
}

function sanitiseError(error: Error): LogEntry['error'] {
  const message = redact(error.message ?? 'Error') as unknown as string;
  const stack = error.stack ? (redact(error.stack) as unknown as string) : undefined;

  return {
    name: redact(error.name ?? 'Error') as unknown as string,
    message,
    stack,
  };
}

function addTruncationBreadcrumbs(serialised: string, entry: LogEntry) {
  if (!Sentry) {
    return;
  }

  const chunks = Math.ceil(serialised.length / BREADCRUMB_CHUNK_BYTES);
  for (let index = 0; index < chunks; index += 1) {
    const slice = serialised.slice(
      index * BREADCRUMB_CHUNK_BYTES,
      (index + 1) * BREADCRUMB_CHUNK_BYTES
    );
    try {
      Sentry.addBreadcrumb({
        category: `${entry.channel}.truncate`,
        level: 'info',
        message: `chunk ${index + 1}/${chunks}`,
        data: { slice },
        timestamp: Date.now() / 1000,
      });
    } catch {
      // ignore breadcrumb failures
    }
  }
}

function enforceSizeLimit(entry: LogEntry): LogEntry {
  try {
    const serialised = JSON.stringify(entry);
    if (serialised.length <= MAX_PAYLOAD_BYTES) {
      return entry;
    }
    addTruncationBreadcrumbs(serialised, entry);
    const truncated: LogEntry = {
      ...entry,
      data: {
        notice: 'Payload truncated to comply with 10KB limit.',
        keys: entry.data ? Object.keys(entry.data) : [],
        originalSize: serialised.length,
      },
    };
    return truncated;
  } catch {
    return entry;
  }
}

function selectConsole(level: LogLevel) {
  switch (level) {
    case 'error':
      return safeGlobalConsole.error.bind(safeGlobalConsole);
    case 'warn':
      return safeGlobalConsole.warn.bind(safeGlobalConsole);
    case 'debug':
    case 'trace':
      return safeGlobalConsole.debug.bind(safeGlobalConsole);
    default:
      return safeGlobalConsole.info.bind(safeGlobalConsole);
  }
}

function createNativeWriter(initialLevel: LogLevel): RuntimeWriter {
  const transport: transportFunctionType<Record<string, unknown>> = ({ msg, level }) => {
    const consoleMethod = selectConsole(level.text as LogLevel);
    try {
      const parsed = JSON.parse(msg);
      consoleMethod(
        `[${(parsed.channel ?? 'app').toUpperCase()}][${level.text.toUpperCase()}]`,
        parsed
      );
    } catch {
      consoleMethod(`[${level.text.toUpperCase()}]`, msg);
    }
  };

  const nativeLogger = ReactNativeLogger.createLogger({
    severity: initialLevel,
    transport,
    levels: LOG_LEVELS,
    printDate: false,
    printLevel: false,
  });

  return {
    write(level, _entry, serialised) {
      nativeLogger[level](serialised);
    },
    setLevel(level) {
      nativeLogger.setSeverity(level);
    },
  };
}

function createNodeWriter(initialLevel: LogLevel): RuntimeWriter {
  let winstonLogger: WinstonLogger | undefined;

  if (dynamicRequire) {
    try {
      const winston = dynamicRequire('winston') as typeof import('winston');
      const options: WinstonLoggerOptions = {
        level: initialLevel,
        levels: LOG_LEVELS,
        transports: [
          new winston.transports.Console({
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
          }),
        ],
      };
      winstonLogger = winston.createLogger(options);
    } catch {
      winstonLogger = undefined;
    }
  }

  return {
    write(level, entry) {
      const consoleMethod = selectConsole(level);
      if (winstonLogger) {
        winstonLogger.log(level, entry.event, {
          entry,
        });
        return;
      }
      consoleMethod(`[${entry.channel.toUpperCase()}][${level.toUpperCase()}]`, entry);
    },
    setLevel(level) {
      if (winstonLogger) {
        winstonLogger.level = level;
        return;
      }
    },
  };
}

function ensureWriter(level: LogLevel): RuntimeWriter {
  if (isReactNative) {
    return createNativeWriter(level);
  }
  return createNodeWriter(level);
}

function handleBreadcrumb(level: BreadcrumbLevel, entry: LogEntry) {
  if (!Sentry) {
    return;
  }

  try {
    Sentry.addBreadcrumb({
      category: entry.namespace ? `${entry.channel}.${entry.namespace}` : entry.channel,
      level,
      message: entry.event,
      data: entry.data,
      timestamp: Date.now() / 1000,
    });
  } catch {
    // ignore
  }
}

function handleWarning(entry: LogEntry) {
  if (!Sentry) {
    return;
  }

  try {
    Sentry.captureMessage(entry.event, {
      level: 'warning',
      tags: {
        channel: entry.channel,
        ...(entry.namespace ? { namespace: entry.namespace } : {}),
      },
      extra: {
        context: entry.context,
        data: entry.data,
      },
    });
  } catch {
    // ignore
  }
}

function handleError(entry: LogEntry, originalError?: Error) {
  if (!Sentry) {
    return;
  }

  const tags = {
    channel: entry.channel,
    ...(entry.namespace ? { namespace: entry.namespace } : {}),
  };

  try {
    if (originalError) {
      const safeError = new Error(redact(originalError.message ?? 'Error') as string);
      safeError.name = redact(originalError.name ?? 'Error') as string;
      safeError.stack = originalError.stack
        ? (redact(originalError.stack) as unknown as string)
        : undefined;
      Sentry.captureException(safeError, {
        level: 'error',
        tags,
        extra: {
          context: entry.context,
          data: entry.data,
        },
      });
      return;
    }
    Sentry.captureMessage(entry.event, {
      level: 'error',
      tags,
      extra: {
        context: entry.context,
        data: entry.data,
        error: entry.error,
      },
    });
  } catch {
    // ignore
  }
}

function handleAudit(entry: LogEntry) {
  if (!Sentry) {
    return;
  }
  try {
    Sentry.captureEvent({
      message: entry.event,
      level: 'info',
      tags: {
        channel: 'audit',
        audit: 'true',
        ...(entry.namespace ? { namespace: entry.namespace } : {}),
      },
      extra: {
        context: entry.context,
        data: entry.data,
      },
    });
  } catch {
    // ignore capture failure
  }
}

function emitToSentry(level: LogLevel, entry: LogEntry, originalError?: Error) {
  if (entry.channel === 'audit') {
    handleAudit(entry);
    return;
  }

  if (level === 'debug' || level === 'trace') {
    handleBreadcrumb('debug', entry);
    return;
  }

  if (level === 'info') {
    handleBreadcrumb('info', entry);
    return;
  }

  if (level === 'warn') {
    handleWarning(entry);
    return;
  }

  if (level === 'error') {
    handleError(entry, originalError);
  }
}

function buildEntry(
  level: LogLevel,
  channel: Channel,
  namespace: string | undefined,
  baseMeta: Record<string, unknown>,
  args: NormalisedArgs,
  event: string
): { entry: LogEntry; originalError?: Error } {
  const timestamp = new Date().toISOString();
  const context = Object.keys(baseMeta).length ? redact(baseMeta) : undefined;
  const data = args.data ? (redact(args.data) as Record<string, unknown>) : undefined;
  const entry: LogEntry = {
    timestamp,
    level,
    channel,
    event,
    namespace,
    context,
    data,
  };

  if (args.error) {
    entry.error = sanitiseError(args.error);
  }

  return { entry, originalError: args.error };
}

function createLoggerInstance(
  options: CreateLoggerOptions = {},
  runtime?: RuntimeState,
  namespaceTrail: string[] = [],
  inheritedMeta: Record<string, unknown> = {}
): LoggerFacade {
  const channel: Channel = options.channel ?? 'app';
  const level: LogLevel = options.level ?? runtime?.level ?? 'info';
  const writer: RuntimeWriter = runtime?.writer ?? ensureWriter(level);
  const appliedMeta: Record<string, unknown> = {
    ...inheritedMeta,
    ...(options.meta ?? {}),
  };
  const namespaceParts = [...namespaceTrail];
  if (options.namespace) {
    namespaceParts.push(options.namespace);
  }
  const namespace = namespaceParts.length ? namespaceParts.join('.') : undefined;

  const state: RuntimeState = runtime ?? {
    writer,
    channel,
    level,
  };

  let metaState = appliedMeta;

  function log(levelToLog: LogLevel, event: string, details: unknown[]) {
    const args = normaliseArgs(details);
    const { entry, originalError } = buildEntry(
      levelToLog,
      state.channel,
      namespace,
      metaState,
      args,
      event
    );
    const finalEntry = enforceSizeLimit(entry);
    const serialised = JSON.stringify(finalEntry);

    if (state.channel === 'audit') {
      if (auditBuffer.length >= AUDIT_BUFFER_LIMIT) {
        auditBuffer.shift();
      }
      auditBuffer.push(finalEntry);
    }

    state.writer.write(levelToLog, finalEntry, serialised);

    emitToSentry(levelToLog, finalEntry, originalError);
  }

  return {
    debug(event, ...details) {
      log('debug', event, details);
    },
    info(event, ...details) {
      log('info', event, details);
    },
    warn(event, ...details) {
      log('warn', event, details);
    },
    error(event, ...details) {
      log('error', event, details);
    },
    setLevel(nextLevel: LogLevel) {
      state.level = nextLevel;
      state.writer.setLevel(nextLevel);
    },
    addMeta(meta) {
      metaState = {
        ...metaState,
        ...meta,
      };
    },
    child(nextNamespace: string, meta: Record<string, unknown> = {}) {
      return createLoggerInstance(
        { level: state.level, channel: state.channel, namespace: nextNamespace, meta },
        state,
        namespaceParts,
        metaState
      );
    },
    audit(event, details = {}) {
      const safeDetails = redact({ ...metaState, ...details }) as Record<string, unknown>;
      const timestamp = new Date().toISOString();
      const entry: LogEntry = {
        timestamp,
        level: 'info',
        channel: 'audit',
        event,
        namespace,
        context: metaState ? (redact(metaState) as Record<string, unknown>) : undefined,
        data: safeDetails,
      };
      if (auditBuffer.length >= AUDIT_BUFFER_LIMIT) {
        auditBuffer.shift();
      }
      auditBuffer.push(entry);
      handleAudit(entry);
      const safeEntry = enforceSizeLimit(entry);
      state.writer.write('info', safeEntry, JSON.stringify(safeEntry));
    },
  };
}

export function createLogger(options: CreateLoggerOptions = {}): LoggerFacade {
  return createLoggerInstance(options);
}

export function getAuditTrail(): LogEntry[] {
  return [...auditBuffer];
}

export type { LogLevel, Channel, LoggerFacade };
