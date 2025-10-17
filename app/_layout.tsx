import '@/global.css';
import '@/lib/i18n';

import { ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import * as Device from 'expo-device';
import { Link, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, Pressable } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Icon } from '@/components/nativewindui/Icon';
import { ThemeToggle } from '@/components/nativewindui/ThemeToggle';
import { cn } from '@/lib/cn';
import { useColorScheme } from '@/lib/useColorScheme';
import { QueryProvider } from '@/providers/QueryProvider';
import { NAV_THEME } from '@/theme';

Sentry.init({
  dsn: 'https://e6b1ecb60dc09016b1b2c9991c40b916@o4510205406281728.ingest.us.sentry.io/4510205414604800',

  // HIPAA Compliance: Disable PII tracking
  // Do NOT send IP addresses, cookies, user info, or other PII
  sendDefaultPii: false,

  // Enable Logs (sanitize logs to avoid PHI)
  enableLogs: true,

  // HIPAA Compliance: Disable Session Replay
  // Session replay can capture sensitive health information
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // HIPAA Compliance: Only include feedback integration (no replay)
  integrations: [Sentry.feedbackIntegration()],

  // Scrub sensitive data from breadcrumbs and events
  beforeSend(event) {
    // Remove user data if accidentally included
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
      delete event.user.ip_address;
    }
    // Remove request data that might contain PHI
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers;
    }
    return event;
  },

  beforeBreadcrumb(breadcrumb) {
    // Remove sensitive data from breadcrumbs
    if (breadcrumb.category === 'console') {
      return null; // Drop console breadcrumbs (might contain PHI)
    }
    if (breadcrumb.data) {
      // Scrub any data that might be sensitive
      delete breadcrumb.data.url;
      delete breadcrumb.data.data;
    }
    return breadcrumb;
  },

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

const isIos26 = Platform.select({ default: false, ios: Device.osVersion?.startsWith('26.') });

export default Sentry.wrap(function RootLayout() {
  const { colorScheme, isDarkColorScheme } = useColorScheme();

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
