import * as Sentry from '@sentry/react-native';
import { logger as rnLogger, type transportFunctionType } from 'react-native-logs';

import { type RedactedContext, redactFields, redactString } from './redact';
import type {
  AuditController,
  AuditLogRecord,
  LoggerFacade,
  LogLevel,
  LogMeta,
  LogRecord,
} from './types';

const LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const SENTRY_LEVEL_MAP: Record<LogLevel, Sentry.SeverityLevel> = {
  debug: 'debug',
  info: 'info',
  warn: 'warning',
  error: 'error',
};

const CONSOLE_METHOD_MAP: Record<LogLevel, keyof Console> = {
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

/**
 * Parses and validates the audit buffer limit from environment variable.
 * Reads from process.env.AUDIT_BUFFER_LIMIT with a default of 500.
 * Validates that the value is a positive integer, falling back to default if invalid.
 *
 * @returns A validated positive integer for the audit buffer limit
 */
function getAuditBufferLimit(): number {
  const defaultValue = 500;
  const envValue = process.env.AUDIT_BUFFER_LIMIT;

  if (!envValue) {
    return defaultValue;
  }

  const parsed = Number.parseInt(envValue, 10);

  if (Number.isNaN(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    console.warn(
      `Invalid AUDIT_BUFFER_LIMIT value "${envValue}". Must be a positive integer. Using default: ${defaultValue}`
    );
    return defaultValue;
  }

  return parsed;
}

/**
 * Maximum number of audit log records to buffer before discarding oldest entries.
 * Configurable via AUDIT_BUFFER_LIMIT environment variable (default: 500).
 * Must be a positive integer.
 */
const AUDIT_BUFFER_LIMIT = getAuditBufferLimit();

const auditBuffer: AuditLogRecord[] = [];

type TransportArgs = unknown[];

type Transport = Parameters<transportFunctionType<Record<string, unknown>>>[0];

interface NormalizedLog {
  message: string;
  category: string;
  redactedContext?: RedactedContext;
  error?: unknown;
}

function toMessage(value: unknown): string {
  if (typeof value === 'string') {
    return redactString(value);
  }

  if (value instanceof Error) {
    return redactString(value.message);
  }

  if (value && typeof value === 'object') {
    const redacted = redactFields(value as Record<string, unknown>);
    try {
      return JSON.stringify(redacted ?? {});
    } catch {
      return '[unserializable message]';
    }
  }

  if (typeof value === 'undefined') {
    return 'undefined';
  }

  return redactString(String(value));
}

function normalizeArgs(args: TransportArgs, extension: string | null | undefined): NormalizedLog {
  const [rawMessage, maybeMeta, ...rest] = Array.isArray(args) ? args : [args];

  const baseMessage = toMessage(rawMessage);

  let meta: LogMeta | undefined;

  if (maybeMeta && typeof maybeMeta === 'object' && !Array.isArray(maybeMeta)) {
    meta = maybeMeta as LogMeta;
  }

  for (const extraArg of rest) {
    if (!meta && extraArg && typeof extraArg === 'object' && !Array.isArray(extraArg)) {
      meta = extraArg as LogMeta;
      break;
    }
  }

  const category =
    (meta?.category && typeof meta.category === 'string' ? meta.category : undefined) ??
    extension ??
    'app';

  const rawContext: Record<string, unknown> | undefined = meta
    ? Object.fromEntries(
        Object.entries(meta).filter(([key]) => key !== 'category' && key !== 'error')
      )
    : undefined;

  return {
    message: baseMessage,
    category,
    redactedContext: redactFields(rawContext),
    error: meta?.error,
  };
}

function addBreadcrumb(record: LogRecord) {
  Sentry.addBreadcrumb({
    message: record.message,
    category: record.category,
    level: SENTRY_LEVEL_MAP[record.level],
    data: record.context,
    timestamp: Date.now() / 1000,
  });
}

function captureWithSentry(record: LogRecord, throwable?: unknown) {
  const severity = SENTRY_LEVEL_MAP[record.level];

  Sentry.withScope((scope) => {
    scope.setLevel(severity);
    scope.setTag('channel', record.channel);
    scope.setTag('category', record.category);
    if (record.channel === 'audit') {
      scope.setTag('audit', 'true');
    }
    if (record.context) {
      scope.setContext('log', record.context);
    }

    if (throwable instanceof Error) {
      scope.setExtra('logger.message', record.message);
      scope.setExtra('logger.timestamp', record.timestamp);
      Sentry.captureException(throwable);
      return;
    }

    scope.setExtra('logger.timestamp', record.timestamp);
    Sentry.captureMessage(record.message, severity);
  });
}

function pushAuditRecord(record: AuditLogRecord) {
  auditBuffer.push(record);
  if (auditBuffer.length > AUDIT_BUFFER_LIMIT) {
    auditBuffer.shift();
  }
}

function handleTransport(props: Transport) {
  const { level, rawMsg, extension } = props;
  const channel = (extension ?? 'app') === 'audit' ? 'audit' : 'app';
  const normalized = normalizeArgs(rawMsg as TransportArgs, extension);
  const timestamp = new Date().toISOString();

  const errorContext =
    normalized.error instanceof Error
      ? {
          errorName: normalized.error.name,
          errorMessage: normalized.error.message,
        }
      : normalized.error
        ? {
            error: toMessage(normalized.error),
          }
        : undefined;

  const mergedContext =
    normalized.redactedContext || errorContext
      ? {
          ...(normalized.redactedContext ?? {}),
          ...(errorContext ?? {}),
        }
      : undefined;

  const levelText = (['debug', 'info', 'warn', 'error'] as const).includes(level.text as any)
    ? (level.text as LogLevel)
    : 'info';
  const record: LogRecord = {
    timestamp,
    level: levelText,
    message: normalized.message,
    category: normalized.category,
    context: mergedContext,
    channel,
  };

  if (channel === 'audit') {
    pushAuditRecord(record as AuditLogRecord);
    return;
  }

  const payload =
    mergedContext && Object.keys(mergedContext).length > 0
      ? [record.message, mergedContext]
      : [record.message];

  const consoleMethod = CONSOLE_METHOD_MAP[record.level] ?? 'log';
  const invokeConsole = console[consoleMethod] as ((...args: unknown[]) => void) | undefined;
  (invokeConsole ?? console.log)(...payload);

  if (record.level === 'info' || record.level === 'debug') {
    addBreadcrumb(record);
    return;
  }

  const throwable = normalized.error instanceof Error ? normalized.error : undefined;
  captureWithSentry(record, throwable);
}

const webLogger = rnLogger.createLogger({
  levels: LEVELS,
  severity: 'info',
  printDate: false,
  printLevel: false,
  transport: handleTransport,
});

const auditExtension = webLogger.extend('audit');

function wrapLogger(extensionLogger: typeof webLogger): LoggerFacade {
  return {
    debug(message, meta) {
      extensionLogger.debug(message, meta);
    },
    info(message, meta) {
      extensionLogger.info(message, meta);
    },
    warn(message, meta) {
      extensionLogger.warn(message, meta);
    },
    error(message, meta) {
      extensionLogger.error(message, meta);
    },
    setLevel(level) {
      webLogger.setSeverity(level);
    },
    getLevel() {
      return webLogger.getSeverity() as LogLevel;
    },
  };
}

export const appLogger: LoggerFacade = wrapLogger(webLogger);
export const auditLogger: LoggerFacade = wrapLogger(auditExtension as unknown as typeof webLogger);

function flushAuditBuffer() {
  if (!auditBuffer.length) {
    return;
  }

  const records = auditBuffer.splice(0, auditBuffer.length);
  for (const record of records) {
    captureWithSentry(record, undefined);
  }
  void Sentry.flush();
}

export const auditController: AuditController = {
  flush: flushAuditBuffer,
  getBufferedRecords() {
    return auditBuffer.slice();
  },
};

export type { LoggerFacade, LogLevel, LogMeta } from './types';
