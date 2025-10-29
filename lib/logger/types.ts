export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogMeta extends Record<string, unknown> {
  category?: string;
  error?: unknown;
}

export interface LoggerFacade {
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
}

export interface AuditController {
  flush(): void;
  getBufferedRecords(): readonly AuditLogRecord[];
}

export interface LogRecord {
  timestamp: string;
  level: LogLevel;
  message: string;
  category: string;
  context?: Record<string, unknown>;
  channel: 'app' | 'audit';
}

export type AuditLogRecord = LogRecord & { channel: 'audit' };
