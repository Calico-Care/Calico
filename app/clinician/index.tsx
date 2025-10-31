import { useRouter } from 'expo-router';
import { Alert, Platform, ScrollView, View } from 'react-native';

import { SkipLink } from '@/components/accessibility/SkipLink';
import { Button } from '@/components/nativewindui/Button';
import { Icon } from '@/components/nativewindui/Icon';
import type { MaterialCommunityIconName } from '@/components/nativewindui/Icon/types';
import { Text } from '@/components/nativewindui/Text';
import { cn } from '@/lib/cn';
import { useTranslation } from '@/lib/i18n';
import { clinicianPatients, type PatientSummary } from '@/lib/mockData';

const RISK_BADGE_CLASS: Record<PatientSummary['riskLevel'], string> = {
  green:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-500/30',
  yellow:
    'bg-amber-100 text-amber-700 dark:bg-amber-400/20 dark:text-amber-200 border border-amber-300 dark:border-amber-500/30',
  red: 'bg-rose-100 text-rose-700 dark:bg-rose-400/20 dark:text-rose-100 border border-rose-300 dark:border-rose-500/30',
};

const RISK_ICON_CLASS: Record<PatientSummary['riskLevel'], string> = {
  green: 'text-emerald-700 dark:text-emerald-200',
  yellow: 'text-amber-700 dark:text-amber-200',
  red: 'text-rose-700 dark:text-rose-100',
};

const RISK_ICONS: Record<PatientSummary['riskLevel'], MaterialCommunityIconName> = {
  green: 'check-circle',
  yellow: 'alert',
  red: 'alert-circle',
};

function RiskBadge({ risk }: { risk: PatientSummary['riskLevel'] }) {
  return (
    <View
      className={`self-start flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${RISK_BADGE_CLASS[risk]}`}
      accessibilityLabel={`${risk} risk level`}
      accessibilityRole="text"
    >
      <Icon
        materialCommunityIcon={{ name: RISK_ICONS[risk] }}
        size={14}
        className={RISK_ICON_CLASS[risk]}
        accessibilityRole="none"
      />
      <Text variant="footnote" className="font-semibold uppercase tracking-wide">
        {risk} risk
      </Text>
    </View>
  );
}

export default function ClinicianDashboardScreen() {
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const scrollClassName = isWeb ? 'web:bg-[#fafafa]' : undefined;
  const { t } = useTranslation();

  // Typed web-only props for ScrollView (e.g., id for anchor navigation)
  const webProps = isWeb ? ({ id: 'main-content' } as { id: string }) : undefined;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className={cn('flex-1 bg-background', scrollClassName)}
      {...webProps}
    >
      {isWeb && <SkipLink href="#main-content" />}
      <View className={cn('gap-6 px-6 pb-16 pt-8', isWeb && 'items-center py-16')}>
        <View className={cn('w-full max-w-5xl gap-2', isWeb && 'web:gap-4')}>
          <Text
            variant="title1"
            className={cn('font-semibold text-foreground', isWeb && 'text-4xl tracking-tight')}
            accessibilityRole="header"
          >
            Clinician control center
          </Text>
          <Text variant="body" color="tertiary" className={cn('leading-6', isWeb && 'text-lg')}>
            Track triage signals across your panel, trigger outreach, and collaborate with the care
            team from one place.
          </Text>
        </View>

        <View
          className={cn(
            'flex-row flex-wrap gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm shadow-black/5 dark:border-border/60 dark:bg-card/95',
            isWeb &&
              'web:w-full web:max-w-5xl web:grid web:grid-cols-3 web:gap-6 web:border-gray-200 web:bg-white web:p-6 web:shadow-xl web:shadow-gray-300/40'
          )}
          accessibilityLabel="Dashboard summary statistics"
        >
          <SummaryTile
            icon="heart-pulse"
            label="Active CHF patients"
            value="42"
            trend="+8% vs last month"
          />
          <SummaryTile
            icon="bell-badge"
            label="Alerts in review"
            value="6"
            trend="3 red — 3 yellow"
          />
          <SummaryTile
            icon="phone-alert"
            label="Escalations today"
            value="4"
            trend="2 nurse — 2 VAPI"
          />
        </View>

        <View
          className={cn('gap-4', isWeb && 'w-full max-w-5xl web:gap-6')}
          accessibilityLabel="Patient list"
        >
          {clinicianPatients.map((patient) => (
            <View
              key={patient.id}
              className={cn(
                'gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm shadow-black/5 dark:border-border/60 dark:bg-card/95',
                isWeb &&
                  'web:rounded-3xl web:border-gray-200 web:bg-white web:p-10 web:shadow-xl web:shadow-gray-300/40 web:gap-6'
              )}
              accessibilityLabel={`Patient ${patient.name}, ${patient.age} years old, ${patient.riskLevel} risk`}
            >
              <View className="flex-row items-center justify-between">
                <View className="gap-1">
                  <Text variant="title2" className="font-semibold text-foreground">
                    {patient.name}
                  </Text>
                  <Text
                    variant="footnote"
                    color="tertiary"
                    accessibilityLabel={`${patient.program} program, ${patient.age} years`}
                  >
                    <Text>{patient.program} program </Text>
                    <Text accessibilityRole="none">·</Text>
                    <Text> {patient.age} yrs</Text>
                  </Text>
                </View>
                <RiskBadge risk={patient.riskLevel} />
              </View>
              <Text variant="body" color="tertiary" className="leading-6">
                {patient.lastAlert}
              </Text>

              <View
                className={cn('flex-row flex-wrap gap-3', isWeb && 'web:gap-4')}
                accessibilityRole="list"
                accessibilityLabel="Patient vital metrics"
              >
                {patient.metrics.map((metric) => (
                  <View
                    key={`${patient.id}-${metric.label}`}
                    className={cn(
                      'min-w-[140px] flex-1 gap-2.5 rounded-xl border border-border/70 bg-background/60 p-4',
                      isWeb &&
                        'web:bg-white web:border-gray-200 web:shadow-md web:shadow-gray-200/30 web:p-5 web:gap-3'
                    )}
                    accessibilityRole={'listitem' as any}
                    accessibilityLabel={`${metric.label}: ${metric.value}${metric.delta ? `. ${metric.delta}` : ''}${metric.threshold ? `. ${metric.threshold}` : ''}`}
                  >
                    <Text variant="footnote" color="tertiary" className="uppercase tracking-wide">
                      {metric.label}
                    </Text>
                    <Text variant="title3" className="font-semibold text-foreground">
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

              <View
                className={cn(
                  'gap-2 rounded-xl bg-primary/5 p-3',
                  isWeb && 'web:bg-blue-50 web:border web:border-blue-100 web:p-4'
                )}
              >
                <Text variant="subhead" className="font-semibold text-primary">
                  Care team note
                </Text>
                <Text variant="body" color="tertiary" className="leading-6">
                  {patient.notes}
                </Text>
              </View>

              <View className="flex-row gap-3">
                <Button
                  onPress={() => router.push('/patient')}
                  variant="secondary"
                  className={cn('flex-1 px-4', isWeb && 'web:rounded-full web:h-12')}
                  accessibilityLabel={t('clinician.patient_view.accessibility.open_label', {
                    name: patient.name,
                    defaultValue: `Open patient view for ${patient.name}`,
                  })}
                  accessibilityHint={t('clinician.patient_view.accessibility.open_hint', {
                    defaultValue: 'Navigates to detailed patient information',
                  })}
                >
                  <Text className="font-semibold text-foreground">Open patient view</Text>
                </Button>
                <Button
                  onPress={() =>
                    Alert.alert('Start outreach', 'This feature is currently in development.')
                  }
                  className={cn('flex-1 px-4', isWeb && 'web:rounded-full web:h-12')}
                  accessibilityLabel={t('clinician.patient_view.accessibility.outreach_label', {
                    name: patient.name,
                    defaultValue: `Start outreach for ${patient.name}`,
                  })}
                  accessibilityHint={t('clinician.patient_view.accessibility.outreach_hint', {
                    defaultValue: 'Begins outreach workflow for the patient',
                  })}
                >
                  <Text className="font-semibold text-white">Start outreach</Text>
                </Button>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  trend,
}: {
  icon: MaterialCommunityIconName;
  label: string;
  value: string;
  trend: string;
}) {
  const isWeb = Platform.OS === 'web';
  return (
    <View
      className={cn(
        'min-w-[150px] flex-1 gap-2 rounded-xl border border-border/60 bg-background/70 p-4',
        isWeb &&
          'web:rounded-2xl web:border-gray-200 web:bg-white web:shadow-md web:shadow-gray-200/30 web:p-5'
      )}
      accessibilityRole={'listitem' as any}
      accessibilityLabel={`${label}: ${value}. ${trend}`}
    >
      <View className="flex-row items-center gap-3">
        <View className="rounded-full bg-primary/10 p-2.5">
          <Icon
            materialCommunityIcon={{ name: icon }}
            className="text-primary"
            size={18}
            accessibilityRole="none"
          />
        </View>
        <Text variant="footnote" color="tertiary" className="uppercase tracking-wide">
          {label}
        </Text>
      </View>
      <Text variant="title2" className="font-semibold text-foreground">
        {value}
      </Text>
      <Text variant="footnote" color="tertiary">
        {trend}
      </Text>
    </View>
  );
}
