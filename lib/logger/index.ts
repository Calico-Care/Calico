import winston from 'winston';

import { redactFields } from './redact';
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

const _AUDIT_BUFFER_LIMIT = 500;
const auditBuffer: AuditLogRecord[] = [];

function pushAuditRecord(record: AuditLogRecord) {
  auditBuffer.push(record);
  if (auditBuffer.length > _AUDIT_BUFFER_LIMIT) {
    auditBuffer.shift();
  }
}

function normalizeMeta(meta: LogMeta | undefined, channel: LogRecord['channel']) {
  const category = meta?.category ?? (channel === 'audit' ? 'audit' : 'app');
  const { error, ...rest } = meta ?? {};
  const context = Object.keys(rest).length ? redactFields(rest) : undefined;

  return { category, context, error };
}

const winstonLogger = winston.createLogger({
  level: 'info',
  levels: LEVELS,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp, ...meta }) =>
      JSON.stringify({
        timestamp,
        level,
        message,
        ...meta,
      })
    )
  ),
  transports: [new winston.transports.Console()],
});

function createFacade(channel: LogRecord['channel']): LoggerFacade {
  return {
    debug(message, meta) {
      logWithLevel('debug', channel, message, meta);
    },
    info(message, meta) {
      logWithLevel('info', channel, message, meta);
    },
    warn(message, meta) {
      logWithLevel('warn', channel, message, meta);
    },
    error(message, meta) {
      logWithLevel('error', channel, message, meta);
    },
    setLevel(level) {
      winstonLogger.level = level;
    },
    getLevel() {
      return winstonLogger.level as LogLevel;
    },
  };
}

function logWithLevel(
  level: LogLevel,
  channel: LogRecord['channel'],
  message: string,
  meta?: LogMeta
) {
  const { category, context, error } = normalizeMeta(meta, channel);
  const record: LogRecord = {
    timestamp: new Date().toISOString(),
    level,
    message,
    category,
    context,
    channel,
  };

  const payload = {
    category,
    channel,
    context,
    ...(error instanceof Error
      ? { error: { name: error.name, message: error.message } }
      : error
        ? { error: String(error) }
        : {}),
  };

  winstonLogger.log(level, message, payload);

  if (channel === 'audit') {
    pushAuditRecord(record as AuditLogRecord);
  }
}

export const appLogger: LoggerFacade = createFacade('app');
export const auditLogger: LoggerFacade = createFacade('audit');

export const auditController: AuditController = {
  flush() {
    if (!auditBuffer.length) {
      return;
    }
    const records = auditBuffer.splice(0, auditBuffer.length);
    for (const record of records) {
      winstonLogger.log(record.level, record.message, {
        category: record.category,
        channel: record.channel,
        context: record.context,
      });
    }
  },
  getBufferedRecords() {
    return auditBuffer;
  },
};

export type { LoggerFacade, LogLevel, LogMeta } from './types';
