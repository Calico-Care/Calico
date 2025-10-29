import { useRouter } from 'expo-router';
import { Platform, ScrollView, View } from 'react-native';

import { Button } from '@/components/nativewindui/Button';
import { Icon } from '@/components/nativewindui/Icon';
import type { MaterialCommunityIconName } from '@/components/nativewindui/Icon/types';
import { Text } from '@/components/nativewindui/Text';
import { cn } from '@/lib/cn';
import { clinicianPatients, type PatientSummary } from '@/lib/mockData';

const RISK_BADGE_CLASS: Record<PatientSummary['riskLevel'], string> = {
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200',
  yellow: 'bg-amber-100 text-amber-700 dark:bg-amber-400/20 dark:text-amber-200',
  red: 'bg-rose-100 text-rose-700 dark:bg-rose-400/20 dark:text-rose-100',
};

function RiskBadge({ risk }: { risk: PatientSummary['riskLevel'] }) {
  return (
    <View className={`self-start rounded-full px-3 py-1 ${RISK_BADGE_CLASS[risk]}`}>
      <Text variant="footnote" className="font-semibold uppercase tracking-wide">
        {risk} risk
      </Text>
    </View>
  );
}

export default function ClinicianDashboardScreen() {
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const scrollStyle = isWeb ? { backgroundColor: '#f5f8ff' } : undefined;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-background"
      style={scrollStyle}
    >
      <View className={cn('gap-6 px-6 pb-16 pt-8', isWeb && 'items-center py-16')}>
        <View className={cn('w-full max-w-5xl gap-2', isWeb && 'web:gap-4')}>
          <Text
            variant="title1"
            className={cn('font-semibold text-foreground', isWeb && 'text-4xl tracking-tight')}
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
              'web:w-full web:max-w-5xl web:grid web:grid-cols-3 web:gap-6 web:border-white/60 web:bg-white/95 web:p-6 web:shadow-lg web:shadow-primary/5 web:backdrop-blur-lg'
          )}
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
            trend="3 red • 3 yellow"
          />
          <SummaryTile
            icon="phone-alert"
            label="Escalations today"
            value="4"
            trend="2 nurse • 2 VAPI"
          />
        </View>

        <View className={cn('gap-4', isWeb && 'w-full max-w-5xl web:gap-6')}>
          {clinicianPatients.map((patient) => (
            <View
              key={patient.id}
              className={cn(
                'gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm shadow-black/5 dark:border-border/60 dark:bg-card/95',
                isWeb &&
                  'web:rounded-3xl web:border-white/70 web:bg-white/95 web:p-8 web:shadow-lg web:shadow-primary/5 web:backdrop-blur-lg'
              )}
            >
              <View className="flex-row items-center justify-between">
                <View className="gap-1">
                  <Text variant="title2" className="font-semibold text-foreground">
                    {patient.name}
                  </Text>
                  <Text variant="footnote" color="tertiary">
                    {patient.program} program • {patient.age} yrs
                  </Text>
                </View>
                <RiskBadge risk={patient.riskLevel} />
              </View>
              <Text variant="body" color="tertiary" className="leading-6">
                {patient.lastAlert}
              </Text>

              <View className="flex-row flex-wrap gap-3">
                {patient.metrics.map((metric) => (
                  <View
                    key={`${patient.id}-${metric.label}`}
                    className={cn(
                      'min-w-[140px] flex-1 gap-2 rounded-xl border border-border/70 bg-background/60 p-3',
                      isWeb && 'web:bg-white web:border-white/60 web:shadow-sm web:shadow-black/5'
                    )}
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

              <View className="gap-2 rounded-xl bg-primary/5 p-3">
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
                >
                  <Text className="font-semibold text-foreground">Open patient view</Text>
                </Button>
                <Button
                  onPress={() => {}}
                  className={cn('flex-1 px-4', isWeb && 'web:rounded-full web:h-12')}
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
          'web:rounded-2xl web:border-white/60 web:bg-white web:shadow-sm web:shadow-primary/5'
      )}
    >
      <View className="flex-row items-center gap-3">
        <View className="rounded-full bg-primary/10 p-2.5">
          <Icon materialCommunityIcon={{ name: icon }} className="text-primary" size={18} />
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
