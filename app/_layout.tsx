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

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

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
