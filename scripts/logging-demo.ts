import { createLogger, getAuditTrail } from '@/src/logging/logger';

const appLogger = createLogger({ channel: 'app', level: 'debug', namespace: 'demo' });
const auditLogger = createLogger({ channel: 'audit', namespace: 'demo' });

appLogger.info('screen_view', { screen: 'Medications' });
appLogger.warn('api_latency', { endpoint: '/patient', ms: 912, phone: '+1 (555) 123-4567' });

try {
  throw new Error('save failed for patient alice@example.com');
} catch (error) {
  appLogger.error('save_failed', error as Error, { patient: 'Alice' });
}

auditLogger.audit('consent_viewed', { version: 'v3', patient: 'Bob' });

if (process.argv.includes('--check')) {
  const auditTrail = getAuditTrail();
  const last = auditTrail.at(-1);
  if (last?.data?.patient !== '[REDACTED]') {
    // eslint-disable-next-line no-console
    console.error('PHI redaction failed in audit trail.');
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log('Logging redaction check complete.');
}
