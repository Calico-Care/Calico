import type { LoggerFacade } from '../logger';

jest.mock('react-native-logs', () => {
  const createLogger = jest.fn((config) => {
    const invokeTransport = (level: string, message: string) => {
      config.transport({
        msg: message,
        rawMsg: message,
        level: { text: level, severity: 0 },
        options: config.transportOptions,
      });
    };

    return {
      debug: jest.fn((msg: string) => invokeTransport('debug', msg)),
      info: jest.fn((msg: string) => invokeTransport('info', msg)),
      warn: jest.fn((msg: string) => invokeTransport('warn', msg)),
      error: jest.fn((msg: string) => invokeTransport('error', msg)),
      trace: jest.fn((msg: string) => invokeTransport('trace', msg)),
      setSeverity: jest.fn(),
    };
  });

  return {
    logger: {
      createLogger,
    },
  };
});

const mockSentry = {
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
  captureException: jest.fn(),
  captureEvent: jest.fn(),
};

jest.mock('@sentry/react-native', () => mockSentry);

describe('createLogger', () => {
  let logger: LoggerFacade;
  let loggingModule: typeof import('../logger');

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    (global as any).navigator = { product: 'ReactNative' };

    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    loggingModule = require('../logger') as typeof import('../logger');
    logger = loggingModule.createLogger({ channel: 'app', level: 'debug' });
  });

  it('adds breadcrumbs for info logs', () => {
    logger.info('screen_view', { screen: 'Medications' });

    expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'app',
        level: 'info',
        message: 'screen_view',
      })
    );
  });

  it('sends warnings to Sentry as warning events', () => {
    logger.warn('api_latency', { endpoint: '/patient', phone: '555-123-4567' });

    expect(mockSentry.captureMessage).toHaveBeenCalledWith(
      'api_latency',
      expect.objectContaining({
        level: 'warning',
        extra: expect.objectContaining({
          data: expect.objectContaining({
            endpoint: '/patient',
            phone: '[REDACTED]',
          }),
        }),
      })
    );
  });

  it('captures errors with redacted payload', () => {
    const error = new Error('Save failed for patient alice@example.com');

    logger.error('save_failed', error, { patient: 'Alice' });

    expect(mockSentry.captureException).toHaveBeenCalled();
    const [sanitisedError, context] = mockSentry.captureException.mock.calls[0];

    expect(sanitisedError.message).toContain('[REDACTED]');
    expect(context.extra?.data?.patient).toBe('[REDACTED]');
  });

  it('emits audit events with audit tags', async () => {
    const auditLogger = loggingModule.createLogger({ channel: 'audit' });

    auditLogger.audit('consent_viewed', { patient: 'Alice', version: 'v3' });

    expect(mockSentry.captureEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'consent_viewed',
        tags: expect.objectContaining({
          channel: 'audit',
          audit: 'true',
        }),
        extra: expect.objectContaining({
          data: expect.objectContaining({
            patient: '[REDACTED]',
          }),
        }),
      })
    );
  });
});
