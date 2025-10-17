import Constants from 'expo-constants';

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
 */

export const env = {
  // Supabase
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',

  // Sentry
  sentryDsn:
    process.env.EXPO_PUBLIC_SENTRY_DSN ||
    'https://e6b1ecb60dc09016b1b2c9991c40b916@o4510205406281728.ingest.us.sentry.io/4510205414604800',

  // API
  apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://api.example.com',

  // Environment
  isDevelopment: process.env.EXPO_PUBLIC_ENV === 'development' || __DEV__,
  isProduction: process.env.EXPO_PUBLIC_ENV === 'production',

  // App Info
  appVersion: Constants.expoConfig?.version || '1.0.0',
  buildVersion:
    Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || '1',
} as const;

// Validate required environment variables in production
if (env.isProduction) {
  const requiredVars = {
    EXPO_PUBLIC_SUPABASE_URL: env.supabaseUrl,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: env.supabaseAnonKey,
  };

  Object.entries(requiredVars).forEach(([key, value]) => {
    if (!value) {
      console.error(`Missing required environment variable: ${key}`);
    }
  });
}
