import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';

import { SkipLink } from '@/components/accessibility/SkipLink';
import { Button } from '@/components/nativewindui/Button';
import { Icon } from '@/components/nativewindui/Icon';
import type { MaterialCommunityIconName } from '@/components/nativewindui/Icon/types';
import { Text } from '@/components/nativewindui/Text';
import { getIconLabel } from '@/lib/accessibility';
import { cn } from '@/lib/cn';
import { useColorScheme } from '@/lib/useColorScheme';

const MOCK_EMAIL = 'clinician@calico.health';

type Highlight = { icon: MaterialCommunityIconName; copy: string };

const WEB_HIGHLIGHTS: Highlight[] = [
  {
    icon: 'shield-check',
    copy: 'HIPAA-ready workspace with automatic audit logging and redaction.',
  },
  {
    icon: 'heart-pulse',
    copy: 'BodyTrace + Terra telemetry blended into a single trend stream.',
  },
  {
    icon: 'account-group',
    copy: 'Role-based access for clinicians, caregivers, and family members.',
  },
];

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const [email, setEmail] = useState(MOCK_EMAIL);
  const [accessCode, setAccessCode] = useState('triage-demo');
  const [submitting, setSubmitting] = useState(false);
  const isWeb = Platform.OS === 'web';
  const scrollClassName = isWeb ? 'web:bg-[#fafafa]' : undefined;

  function handleLogin() {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      router.push('/role-selection');
    }, 650);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className={cn('flex-1 bg-background', isWeb && 'bg-transparent')}
    >
      {isWeb && <SkipLink href="#main-content" />}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
        className={cn('flex-1 bg-background', scrollClassName)}
        {...(isWeb &&
          ({
            id: 'main-content',
          } as any))}
      >
        <View className={cn('flex-1 items-center justify-center px-6 py-10', isWeb && 'py-20')}>
          <View
            className={cn(
              'w-full max-w-md gap-8',
              isWeb && 'max-w-5xl web:flex-row web:items-start web:justify-between web:gap-16'
            )}
          >
            <View className={cn('gap-3', isWeb && 'web:flex-1 web:max-w-lg web:gap-5')}>
              <Text
                variant="largeTitle"
                className={cn(
                  'font-semibold text-foreground',
                  isWeb && 'text-5xl leading-tight tracking-tight'
                )}
                accessibilityRole="header"
              >
                Welcome back to Calico Care.
              </Text>
              <Text variant="body" color="tertiary" className={cn('leading-6', isWeb && 'text-lg')}>
                Review real-time telemetry, triage escalations from VAPI, and keep every patient on
                track with BodyTrace-connected care plans.
              </Text>
              {isWeb && (
                <View className="gap-3 pt-4">
                  {WEB_HIGHLIGHTS.map((item) => (
                    <View
                      key={item.copy}
                      className="flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-md shadow-gray-200/50"
                    >
                      <View className="rounded-full bg-primary/10 p-2.5">
                        <Icon
                          materialCommunityIcon={{ name: item.icon }}
                          className="text-primary"
                          size={20}
                          accessibilityLabel={getIconLabel(item.icon)}
                          accessibilityRole="none"
                        />
                      </View>
                      <Text variant="body" className="flex-1 text-foreground">
                        {item.copy}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <View
              className={cn(
                'gap-5 rounded-2xl border border-border bg-card/90 p-6 shadow-sm shadow-black/5 dark:border-border/60 dark:bg-card',
                isWeb &&
                  'web:flex-1 web:max-w-md web:rounded-3xl web:border-gray-200 web:bg-white web:px-10 web:py-10 web:shadow-xl web:shadow-gray-300/40 web:gap-6'
              )}
            >
              <View className={cn('gap-2.5', isWeb && 'web:gap-3')}>
                <Text
                  variant="subhead"
                  className="text-foreground"
                  // @ts-expect-error - web-only htmlFor prop
                  htmlFor={isWeb ? 'email-input' : undefined}
                >
                  Organization email
                </Text>
                <TextInput
                  {...(isWeb &&
                    ({
                      id: 'email-input',
                      'aria-required': 'true',
                    } as any))}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder="you@organization.com"
                  placeholderTextColor="rgba(142,142,147,0.7)"
                  value={email}
                  onChangeText={setEmail}
                  className={cn(
                    'w-full rounded-xl border border-border/80 bg-background px-4 py-[14px] text-base text-foreground',
                    isWeb && 'web:border-gray-300 web:bg-white web:min-h-[48px]'
                  )}
                  accessibilityLabel="Organization email address"
                  accessibilityHint="Enter your organization email address to sign in"
                />
              </View>
              <View className={cn('gap-2.5', isWeb && 'web:gap-3')}>
                <Text
                  variant="subhead"
                  className="text-foreground"
                  // @ts-expect-error - web-only htmlFor prop
                  htmlFor={isWeb ? 'access-code-input' : undefined}
                >
                  Access code
                </Text>
                <TextInput
                  {...(isWeb &&
                    ({
                      id: 'access-code-input',
                      'aria-required': 'true',
                    } as any))}
                  autoCapitalize="none"
                  secureTextEntry
                  placeholder="Enter secure access code"
                  placeholderTextColor="rgba(142,142,147,0.7)"
                  value={accessCode}
                  onChangeText={setAccessCode}
                  className={cn(
                    'w-full rounded-xl border border-border/80 bg-background px-4 py-[14px] text-base text-foreground',
                    isWeb && 'web:border-gray-300 web:bg-white web:min-h-[48px]'
                  )}
                  accessibilityLabel="Access code"
                  accessibilityHint="Enter your secure access code"
                />
              </View>
              <Button
                onPress={handleLogin}
                disabled={submitting}
                className={cn('mt-2', isWeb && 'web:h-12 web:rounded-full')}
                accessibilityLabel="Sign in to Calico Care"
                accessibilityHint="Signs in with your organization email and access code"
                accessibilityState={{ disabled: submitting }}
              >
                {submitting ? (
                  <ActivityIndicator
                    color={colors.primaryForeground}
                    accessibilityLabel="Signing in"
                  />
                ) : (
                  <Text className="font-semibold text-white">Sign in</Text>
                )}
              </Button>
              <Text
                variant="footnote"
                color="tertiary"
                className={cn('text-center leading-5', isWeb && 'text-[13px]')}
              >
                Mock environment ? Credentials are prefilled for demo purposes
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
