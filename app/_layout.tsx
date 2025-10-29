import '@/global.css';
import '@/lib/i18n';

import { ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import * as Device from 'expo-device';
import { Link, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Platform, Pressable } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Icon } from '@/components/nativewindui/Icon';
import { ThemeToggle } from '@/components/nativewindui/ThemeToggle';
import { env } from '@/config/env';
import { cn } from '@/lib/cn';
import { auditController } from '@/lib/logger';
import { redactFields } from '@/lib/logger/redact';
import { useColorScheme } from '@/lib/useColorScheme';
import { QueryProvider } from '@/providers/QueryProvider';
import { NAV_THEME } from '@/theme';

function scrubValue(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => scrubValue(entry));
  }

  return redactFields(value as Record<string, unknown>);
}

Sentry.init({
  dsn: env.sentryDsn,
  sendDefaultPii: false,
  debug: __DEV__,
  integrations: [Sentry.feedbackIntegration()],
  enableAutoSessionTracking: true,
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  beforeSend(event) {
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers;
    }

    if (event.user) {
      event.user = undefined;
    }

    if (event.contexts) {
      Object.entries(event.contexts).forEach(([key, contextValue]) => {
        event.contexts![key] = scrubValue(contextValue) as Record<string, unknown>;
      });
    }

    if (event.extra && typeof event.extra === 'object') {
      event.extra = scrubValue(event.extra) as Record<string, unknown>;
    }

    return event;
  },
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === 'console') {
      return null;
    }

    if (breadcrumb.data && typeof breadcrumb.data === 'object') {
      breadcrumb.data = scrubValue(breadcrumb.data) as NonNullable<typeof breadcrumb.data>;
    }

    return breadcrumb;
  },
});

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

const isIos26 = Platform.select({ default: false, ios: Device.osVersion?.startsWith('26.') });

export default Sentry.wrap(function RootLayout() {
  const { colorScheme, isDarkColorScheme } = useColorScheme();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        auditController.flush();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <>
      <StatusBar
        key={`root-status-bar-${isDarkColorScheme ? 'light' : 'dark'}`}
        style={isDarkColorScheme ? 'light' : 'dark'}
      />
      {/* WRAP YOUR APP WITH ANY ADDITIONAL PROVIDERS HERE */}
      <QueryProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <NavThemeProvider value={NAV_THEME[colorScheme]}>
            <Stack>
              <Stack.Screen name="index" options={INDEX_OPTIONS} />
              <Stack.Screen name="modal" options={MODAL_OPTIONS} />
            </Stack>
          </NavThemeProvider>
        </GestureHandlerRootView>
      </QueryProvider>
    </>
  );
});

const INDEX_OPTIONS = {
  headerLargeTitle: true,
  headerTransparent: isIos26,
  title: 'NativewindUI',
  headerRight: () => <SettingsIcon />,
} as const;

function SettingsIcon() {
  return (
    <Link href="/modal" asChild>
      <Pressable className={cn('opacity-80 active:opacity-50', isIos26 && 'px-1.5')}>
        <Icon name="gearshape" className="text-foreground" />
      </Pressable>
    </Link>
  );
}

const MODAL_OPTIONS = {
  presentation: 'modal',
  animation: 'fade_from_bottom', // for android
  title: 'Settings',
  headerRight: () => <ThemeToggle />,
} as const;
