import Constants from 'expo-constants';

function parseSampleRate(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
    return parsed;
  }

  console.warn(
    `Invalid EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE "${value}" provided. Falling back to ${fallback}.`
  );
  return fallback;
}

function parseTracePropagationTargets(
  value: string | undefined,
  defaultTargets: (string | RegExp)[]
) {
  if (!value) {
    return defaultTargets;
  }

  const targets = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return targets.length > 0 ? targets : defaultTargets;
}

const expoEnv = process.env.EXPO_PUBLIC_ENV;
const isDevelopment = expoEnv === 'development' || __DEV__;
const isProduction = expoEnv === 'production';
const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://api.example.com';

const defaultTracePropagationTargets: (string | RegExp)[] = [
  apiUrl,
  /^https?:\/\/localhost(:\d+)?$/i,
];

const sentryTracesSampleRate = parseSampleRate(
  process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  isProduction ? 0.05 : 1
);

const sentryTracePropagationTargets = parseTracePropagationTargets(
  process.env.EXPO_PUBLIC_SENTRY_TRACE_PROPAGATION_TARGETS,
  defaultTracePropagationTargets
);

/**
 * Environment configuration
 *
 * To use environment variables in Expo:
 * 1. Create a .env file in the root directory
 * 2. Add variables with EXPO_PUBLIC_ prefix
 * 3. Access them via process.env.EXPO_PUBLIC_*
 *
 * For production, set these in EAS secrets:
 * eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value <value>
 *
 * Note: This project uses Supabase's new API keys system with publishable keys (sb_publishable_...)
 */

export const env = {
  // Supabase
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',

  // Sentry
  sentryDsn:
    process.env.EXPO_PUBLIC_SENTRY_DSN ||
    'https://e6b1ecb60dc09016b1b2c9991c40b916@o4510205406281728.ingest.us.sentry.io/4510205414604800',

  // API
  apiUrl,

  // Environment
  isDevelopment,
  isProduction,

  // App Info
  appVersion: Constants.expoConfig?.version || '1.0.0',
  buildVersion:
    Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || '1',

  // Sentry tracing
  sentryTracesSampleRate,
  sentryTracePropagationTargets,
} as const;

// Validate required environment variables in production
if (env.isProduction) {
  const requiredVars = {
    EXPO_PUBLIC_SUPABASE_URL: env.supabaseUrl,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.supabasePublishableKey,
  };

  Object.entries(requiredVars).forEach(([key, value]) => {
    if (!value) {
      console.error(`Missing required environment variable: ${key}`);
    }
  });
}
