const { withNativeWind } = require('nativewind/metro');

const { getSentryExpoConfig } = require('@sentry/react-native/metro');

/** @type {import('expo/metro-config').MetroConfig} */

const config = getSentryExpoConfig(__dirname);

const webSourceExts = ['web.ts', 'web.tsx', 'web.js', 'web.jsx'];

if (!config.resolver) {
  config.resolver = {};
}

const existingSourceExts = config.resolver.sourceExts ?? [];
config.resolver.sourceExts = [...new Set([...existingSourceExts, ...webSourceExts])];

const existingPlatforms = config.resolver.platforms ?? [];
config.resolver.platforms = [...new Set([...existingPlatforms, 'ios', 'android', 'native', 'web'])];

module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });
