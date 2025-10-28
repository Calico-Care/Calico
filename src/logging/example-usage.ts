import { createLogger } from '@/src/logging/logger';

const appLogger = createLogger({ channel: 'app', level: 'debug' });
const auditLogger = createLogger({ channel: 'audit', namespace: 'compliance' });

appLogger.info('screen_view', { screen: 'Medications' });
appLogger.warn('api_latency', { endpoint: '/patient', ms: 912 });

try {
  throw new Error('Save failed because backend timed out');
} catch (error) {
  appLogger.error('save_failed', error as Error, { recordId: 'med-42' });
}

auditLogger.audit('consent_viewed', { version: 'v3' });
