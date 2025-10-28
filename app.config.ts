import type { ConfigContext, ExpoConfig } from '@expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const releaseSha =
    process.env.RELEASE_SHA ??
    process.env.EXPO_PUBLIC_RELEASE_SHA ??
    process.env.EAS_BUILD_GIT_COMMIT_SHA ??
    null;

  const sentryOrg = process.env.SENTRY_ORG ?? 'calico-care';
  const sentryProject = process.env.SENTRY_PROJECT ?? 'calico-native';
  const sentryUrl = process.env.SENTRY_URL ?? 'https://sentry.io/';

  return {
    ...config,
    name: 'calico',
    slug: 'calico',
    version: '1.0.0',
    scheme: 'calico',
    platforms: ['ios', 'android', 'web'],
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        '@sentry/react-native/expo',
        {
          organization: sentryOrg,
          project: sentryProject,
          url: sentryUrl,
        },
      ],
      'expo-localization',
    ],
    experiments: {
      typedRoutes: true,
      tsconfigPaths: true,
    },
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.vesko.calico.calico',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: 'com.vesko.calico.calico',
    },
    extra: {
      ...config.extra,
      router: {},
      eas: {
        projectId: 'f7c8f6f1-eecf-4add-825c-c7ef2bc53068',
      },
      releaseSha,
    },
  };
};
