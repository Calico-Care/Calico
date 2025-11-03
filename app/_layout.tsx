import '@/lib/polyfills/process';
import '@/lib/polyfills/setImmediate';
import '@/lib/polyfills/util';
import '@/global.css';
import '@/lib/i18n';

import { ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import type { Integration, SpanAttributes, SpanAttributeValue } from '@sentry/types';
import { isRunningInExpoGo } from 'expo';
import * as Device from 'expo-device';
import { Link, Stack, useNavigationContainerRef, useSegments } from 'expo-router';
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

function matchesTraceTarget(url: string, target: string | RegExp): boolean {
  if (target instanceof RegExp) {
    return target.test(url);
  }

  // Attempt to compare two absolute URLs by origin.
  try {
    const targetUrl = new URL(target);
    const requestUrl = new URL(url, targetUrl.origin);
    return requestUrl.origin === targetUrl.origin;
  } catch (_error) {
    // Parse the request URL to compare hostname and optional port against hostname-only targets.
    try {
      const requestUrl = new URL(url);
      const hostnameWithPort = requestUrl.port
        ? `${requestUrl.hostname}:${requestUrl.port}`
        : requestUrl.hostname;

      if (hostnameWithPort === target || requestUrl.hostname === target) {
        return true;
      }
    } catch {
      // Ignore parsing failures for relative URLs and fall back to string prefix checks.
    }

    // Fall back to string prefix matching, including http/https variants.
    const httpTarget = `http://${target}`;
    const httpsTarget = `https://${target}`;
    return url.startsWith(target) || url.startsWith(httpTarget) || url.startsWith(httpsTarget);
  }
}

function scrubSpanData(data: Record<string, unknown>): SpanAttributes {
  const sanitizedEntries: Record<string, SpanAttributeValue | undefined> = {};

  Object.entries(data).forEach(([key, value]) => {
    const scrubbed = scrubValue(value);

    if (
      scrubbed === null ||
      scrubbed === undefined ||
      typeof scrubbed === 'string' ||
      typeof scrubbed === 'number' ||
      typeof scrubbed === 'boolean'
    ) {
      sanitizedEntries[key] = scrubbed ?? undefined;
      return;
    }

    if (Array.isArray(scrubbed)) {
      const isStringArray = scrubbed.every(
        (item) => item === null || item === undefined || typeof item === 'string'
      );
      if (isStringArray) {
        sanitizedEntries[key] = scrubbed as Array<null | undefined | string>;
        return;
      }

      const isNumberArray = scrubbed.every(
        (item) => item === null || item === undefined || typeof item === 'number'
      );
      if (isNumberArray) {
        sanitizedEntries[key] = scrubbed as Array<null | undefined | number>;
        return;
      }

      const isBooleanArray = scrubbed.every(
        (item) => item === null || item === undefined || typeof item === 'boolean'
      );
      if (isBooleanArray) {
        sanitizedEntries[key] = scrubbed as Array<null | undefined | boolean>;
      }
    }
  });

  return sanitizedEntries;
}

const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: !isRunningInExpoGo(),
  ignoreEmptyBackNavigationTransactions: true,
});

const tracingIntegration =
  env.sentryTracesSampleRate > 0
    ? Sentry.reactNativeTracingIntegration({
        shouldCreateSpanForRequest(url) {
          return env.sentryTracePropagationTargets.some((target) =>
            matchesTraceTarget(url, target)
          );
        },
      })
    : null;

Sentry.init({
  dsn: env.sentryDsn,
  sendDefaultPii: false,
  debug: __DEV__,
  integrations(defaultIntegrations) {
    const integrations: Integration[] = [...defaultIntegrations, Sentry.feedbackIntegration()];

    const result = integrations.filter(
      (integration) =>
        integration.name !== navigationIntegration.name &&
        (!tracingIntegration || integration.name !== tracingIntegration.name)
    );

    result.push(navigationIntegration);

    if (tracingIntegration) {
      result.push(tracingIntegration);
    }

    return result;
  },
  enableAutoSessionTracking: true,
  tracesSampleRate: env.sentryTracesSampleRate,
  tracePropagationTargets: env.sentryTracePropagationTargets,
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
  beforeSendTransaction(event) {
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

    if (Array.isArray(event.spans)) {
      event.spans = event.spans.map((span) => {
        if (span?.data && typeof span.data === 'object') {
          return {
            ...span,
            data: scrubSpanData(span.data as Record<string, unknown>),
          };
        }

        return span;
      });
    }

    return event;
  },
});

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

const isIos26 = Platform.select({ default: false, ios: Device.osVersion?.startsWith('26.') });

const RootLayout = Sentry.wrap(function RootLayout() {
  const { colorScheme, isDarkColorScheme } = useColorScheme();
  const navigationRef = useNavigationContainerRef();
  const segments = useSegments();
  const navigationKey = segments.length > 0 ? `/${segments.join('/')}` : '/';

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

  useEffect(() => {
    tracingIntegration?.setCurrentRoute(navigationKey);
  }, [navigationKey]);

  useEffect(() => {
    if (navigationRef) {
      navigationIntegration.registerNavigationContainer(navigationRef);
    }
  }, [navigationRef]);

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
            <Stack ref={navigationRef}>
              <Stack.Screen name="index" options={INDEX_OPTIONS} />
              <Stack.Screen name="role-selection" options={ROLE_SELECTION_OPTIONS} />
              <Stack.Screen name="clinician" options={CLINICIAN_OPTIONS} />
              <Stack.Screen name="patient" options={PATIENT_OPTIONS} />
              <Stack.Screen name="modal" options={MODAL_OPTIONS} />
            </Stack>
          </NavThemeProvider>
        </GestureHandlerRootView>
      </QueryProvider>
    </>
  );
});

export default RootLayout;

const INDEX_OPTIONS = {
  headerShown: false,
} as const;

const ROLE_SELECTION_OPTIONS = {
  title: 'Choose workspace',
  headerLargeTitle: true,
  headerTransparent: isIos26,
  headerRight: () => <SettingsIcon />,
} as const;

const CLINICIAN_OPTIONS = {
  title: 'Clinician dashboard',
  headerLargeTitle: false,
  headerRight: () => <SettingsIcon />,
} as const;

const PATIENT_OPTIONS = {
  title: 'Patient dashboard',
  headerLargeTitle: false,
  headerRight: () => <SettingsIcon />,
} as const;

const MODAL_OPTIONS = {
  presentation: 'modal',
  animation: 'fade_from_bottom', // for android
  title: 'Settings',
  headerRight: () => <ThemeToggle />,
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
