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

import { Button } from '@/components/nativewindui/Button';
import { Icon } from '@/components/nativewindui/Icon';
import type { MaterialCommunityIconName } from '@/components/nativewindui/Icon/types';
import { Text } from '@/components/nativewindui/Text';
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
  const scrollStyle = isWeb ? { backgroundColor: '#f6f8ff' } : undefined;

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
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
        className="flex-1"
        style={scrollStyle}
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
                      className="flex-row items-center gap-3 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-sm shadow-black/10 backdrop-blur-sm"
                    >
                      <View className="rounded-full bg-primary/10 p-2.5">
                        <Icon
                          materialCommunityIcon={{ name: item.icon }}
                          className="text-primary"
                          size={20}
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
                'gap-4 rounded-2xl border border-border bg-card/90 p-6 shadow-sm shadow-black/5 dark:border-border/60 dark:bg-card',
                isWeb &&
                  'web:flex-1 web:max-w-md web:rounded-3xl web:border-white/70 web:bg-white/95 web:px-8 web:py-8 web:shadow-xl web:shadow-primary/5 web:backdrop-blur-lg'
              )}
            >
              <View className="gap-2">
                <Text variant="subhead" className="text-foreground">
                  Organization email
                </Text>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder="you@organization.com"
                  placeholderTextColor="rgba(142,142,147,0.7)"
                  value={email}
                  onChangeText={setEmail}
                  className={cn(
                    'w-full rounded-xl border border-border/80 bg-background px-4 py-[14px] text-base text-foreground',
                    isWeb && 'web:border-white/70 web:bg-white'
                  )}
                />
              </View>
              <View className="gap-2">
                <Text variant="subhead" className="text-foreground">
                  Access code
                </Text>
                <TextInput
                  autoCapitalize="none"
                  secureTextEntry
                  placeholder="Enter secure access code"
                  placeholderTextColor="rgba(142,142,147,0.7)"
                  value={accessCode}
                  onChangeText={setAccessCode}
                  className={cn(
                    'w-full rounded-xl border border-border/80 bg-background px-4 py-[14px] text-base text-foreground',
                    isWeb && 'web:border-white/70 web:bg-white'
                  )}
                />
              </View>
              <Button
                onPress={handleLogin}
                disabled={submitting}
                className={cn('mt-2', isWeb && 'web:h-12 web:rounded-full')}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text className="font-semibold text-white">Sign in</Text>
                )}
              </Button>
              <Text
                variant="footnote"
                color="tertiary"
                className={cn('text-center leading-5', isWeb && 'text-[13px]')}
              >
                Mock environment • Credentials are prefilled for demo purposes
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
