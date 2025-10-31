import * as Haptics from 'expo-haptics';
import { Platform, ScrollView, type StyleProp, View, type ViewStyle } from 'react-native';

import { SkipLink } from '@/components/accessibility/SkipLink';
import { Button } from '@/components/nativewindui/Button';
import { Icon } from '@/components/nativewindui/Icon';
import { Text } from '@/components/nativewindui/Text';
import { getIconLabel } from '@/lib/accessibility';
import { cn } from '@/lib/cn';
import { appLogger, auditController, auditLogger } from '@/lib/logger';
import { patientDetail } from '@/lib/mockData';

const ALERT_BADGE_CLASS = {
  active: 'bg-primary/10 text-primary border border-primary/30',
  resolved:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-500/30',
} as const;

const scrollStyle: StyleProp<ViewStyle> =
  Platform.OS === 'web' ? ({ backgroundColor: '#f5f8ff' } satisfies ViewStyle) : undefined;

export default function PatientDashboardScreen() {
  function triggerSentryTest() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const error = new Error('Intentional patient dashboard Sentry test');
    appLogger.error('Patient dashboard Sentry smoke test', {
      category: 'diagnostics.patient',
      error,
      channel: 'app',
    });
    auditLogger.info('Audit breadcrumb recorded from patient view', {
      category: 'audit.patient',
      action: 'sentry-test',
    });
    auditController.flush();
  }

  const isWeb = Platform.OS === 'web';
  const scrollClassName = isWeb ? 'web:bg-card' : undefined;

  return (
    <>
      {isWeb && <SkipLink href="#main-content" />}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className={cn('flex-1 bg-background', scrollClassName)}
        style={scrollStyle}
        {...(isWeb
          ? ({
              id: 'main-content',
            } as const)
          : null)}
      >
        <View className={cn('gap-6 px-6 pb-16 pt-8', isWeb && 'items-center py-16')}>
          <View
            className={cn(
              'gap-2 rounded-2xl border border-border bg-card p-5 shadow-sm shadow-black/5 dark:border-border/60 dark:bg-card/95',
              isWeb &&
                'web:w-full web:max-w-4xl web:rounded-3xl web:border-white/70 web:bg-white/95 web:p-8 web:shadow-lg web:shadow-primary/5 web:backdrop-blur-lg'
            )}
          >
            <View className="flex-row items-center justify-between gap-3">
              <View className="gap-1">
                <Text
                  variant="title1"
                  className={cn(
                    'font-semibold text-foreground',
                    isWeb && 'text-4xl tracking-tight'
                  )}
                  accessibilityRole="header"
                >
                  {patientDetail.name}
                </Text>
                <Text variant="footnote" color="tertiary">
                  {patientDetail.program} Remote Monitoring • {patientDetail.room}
                </Text>
              </View>
              <View className="items-end gap-1">
                <Text variant="footnote" color="tertiary">
                  Primary clinician
                </Text>
                <Text variant="subhead" className="font-semibold text-foreground">
                  {patientDetail.primaryClinician}
                </Text>
              </View>
            </View>
            <View
              className={cn(
                'mt-4 flex-row items-center justify-between rounded-xl bg-primary/5 p-4',
                isWeb && 'web:rounded-2xl web:bg-primary/8 web:px-6 web:py-5'
              )}
            >
              <View className="gap-1">
                <Text variant="subhead" className="font-semibold text-primary">
                  Next check-in
                </Text>
                <Text variant="body" color="tertiary">
                  {patientDetail.nextCheckIn}
                </Text>
              </View>
              <Button
                onPress={triggerSentryTest}
                className={cn(
                  'px-4',
                  isWeb && 'web:rounded-full web:h-11 web:px-6 web:flex-row web:gap-2'
                )}
                accessibilityLabel="Send Sentry test alert"
                accessibilityHint="Triggers a test error to verify error tracking is working"
              >
                <Icon
                  materialCommunityIcon={{ name: 'alert-circle' }}
                  className="text-white"
                  accessibilityLabel={getIconLabel('alert-circle')}
                  accessibilityRole="none"
                />
                <Text className="font-semibold text-white">Send Sentry test</Text>
              </Button>
            </View>
          </View>

          <View className={cn('gap-3 w-full', isWeb && 'max-w-4xl')}>
            <Text
              variant="title3"
              className={cn('font-semibold text-foreground', isWeb && 'text-2xl tracking-tight')}
              accessibilityRole="header"
            >
              Today&apos;s vitals
            </Text>
            <View
              className={cn(
                'flex-row flex-wrap gap-3',
                isWeb && 'web:grid web:grid-cols-2 web:gap-5'
              )}
              accessibilityRole="list"
              accessibilityLabel="Today's vital metrics"
            >
              {patientDetail.metrics.map((metric) => (
                <View
                  key={metric.label}
                  className={cn(
                    'min-w-[140px] flex-1 gap-2 rounded-xl border border-border/70 bg-card/90 p-4 shadow-sm shadow-black/5',
                    isWeb &&
                      'web:rounded-2xl web:border-white/70 web:bg-white web:shadow-sm web:shadow-primary/5 web:p-5'
                  )}
                  accessibilityRole={'listitem' as any}
                  accessibilityLabel={`${metric.label}: ${metric.value}${metric.delta ? `. ${metric.delta}` : ''}${metric.threshold ? `. ${metric.threshold}` : ''}`}
                >
                  <Text variant="footnote" color="tertiary" className="uppercase tracking-wide">
                    {metric.label}
                  </Text>
                  <Text variant="title2" className="font-semibold text-foreground">
                    {metric.value}
                  </Text>
                  {metric.delta ? (
                    <Text variant="footnote" color="tertiary">
                      {metric.delta}
                    </Text>
                  ) : null}
                  {metric.threshold ? (
                    <Text variant="footnote" color="tertiary">
                      {metric.threshold}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>

          <View className="gap-3">
            <Text
              variant="title3"
              className="font-semibold text-foreground"
              accessibilityRole="header"
            >
              Recent alerts
            </Text>
            <View
              className={cn('gap-3', isWeb && 'web:grid web:grid-cols-2 web:gap-5')}
              accessibilityRole="list"
              accessibilityLabel="Recent health alerts"
            >
              {patientDetail.recentAlerts.map((alert) => (
                <View
                  key={alert.id}
                  className={cn(
                    'gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm shadow-black/5 dark:border-border/60 dark:bg-card/95',
                    isWeb &&
                      'web:rounded-3xl web:border-white/70 web:bg-white/95 web:p-6 web:shadow-sm web:shadow-primary/5'
                  )}
                  accessibilityRole={'listitem' as any}
                  accessibilityLabel={`Alert ${alert.resolved ? 'resolved' : 'in progress'}: ${alert.message}. Created ${alert.createdAt}`}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <Icon
                        materialCommunityIcon={{
                          name: alert.resolved ? 'check-circle' : 'alert-circle',
                        }}
                        className={alert.resolved ? 'text-emerald-400' : 'text-primary'}
                        size={18}
                        accessibilityLabel={getIconLabel(
                          alert.resolved ? 'check-circle' : 'alert-circle'
                        )}
                        accessibilityRole="none"
                      />
                      <Text variant="subhead" className="font-semibold text-foreground">
                        {alert.message}
                      </Text>
                    </View>
                    <Text variant="footnote" color="tertiary">
                      {alert.createdAt}
                    </Text>
                  </View>
                  <View
                    className={cn(
                      'self-start flex-row items-center gap-1.5 rounded-full px-3 py-1.5',
                      ALERT_BADGE_CLASS[alert.resolved ? 'resolved' : 'active']
                    )}
                    accessibilityRole="text"
                  >
                    <Icon
                      materialCommunityIcon={{
                        name: alert.resolved ? 'check-circle' : 'alert-circle',
                      }}
                      size={12}
                      className={
                        alert.resolved ? 'text-emerald-700 dark:text-emerald-200' : 'text-primary'
                      }
                      accessibilityRole="none"
                    />
                    <Text variant="footnote" className="font-semibold uppercase tracking-wide">
                      {alert.resolved ? 'Resolved' : 'In progress'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View className={cn('gap-3 w-full', isWeb && 'max-w-4xl')}>
            <Text
              variant="title3"
              className={cn('font-semibold text-foreground', isWeb && 'text-2xl tracking-tight')}
              accessibilityRole="header"
            >
              Daily care plan
            </Text>
            <View
              className={cn(
                'gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm shadow-black/5 dark:border-border/60 dark:bg-card/95',
                isWeb &&
                  'web:rounded-3xl web:border-white/70 web:bg-white/95 web:p-6 web:shadow-sm web:shadow-primary/5'
              )}
              accessibilityRole="list"
              accessibilityLabel="Daily care plan tasks"
            >
              {patientDetail.carePlan.map((item, index) => (
                <View
                  key={item}
                  className="flex-row items-start gap-3"
                  accessibilityRole={'listitem' as any}
                >
                  <Text variant="subhead" className="pt-0.5 text-primary">
                    {index + 1}.
                  </Text>
                  <Text variant="body" color="tertiary" className="flex-1 leading-6">
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
