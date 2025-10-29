import { useRouter } from 'expo-router';
import { Platform, ScrollView, View } from 'react-native';

import { Button } from '@/components/nativewindui/Button';
import { Icon } from '@/components/nativewindui/Icon';
import type { MaterialCommunityIconName } from '@/components/nativewindui/Icon/types';
import { Text } from '@/components/nativewindui/Text';
import { cn } from '@/lib/cn';
import { useTranslation } from '@/lib/i18n';

type RoleCard = {
  key: 'clinician' | 'patient';
  titleKey: string;
  descriptionKey: string;
  fallbackTitle: string;
  fallbackDescription: string;
  fallbackRoleName: string;
  icon: MaterialCommunityIconName;
  route: '/clinician' | '/patient';
};

const ROLE_CARDS: RoleCard[] = [
  {
    key: 'clinician',
    titleKey: 'role_selection.cards.clinician.title',
    descriptionKey: 'role_selection.cards.clinician.description',
    fallbackTitle: 'Clinician control center',
    fallbackDescription:
      'Manage escalations, trend reviews, and caregiver assignments across your caseload.',
    fallbackRoleName: 'Clinician',
    icon: 'stethoscope',
    route: '/clinician',
  },
  {
    key: 'patient',
    titleKey: 'role_selection.cards.patient.title',
    descriptionKey: 'role_selection.cards.patient.description',
    fallbackTitle: 'Patient & family view',
    fallbackDescription:
      'Preview the daily routines, check-ins, and education families see when onboarded.',
    fallbackRoleName: 'Patient',
    icon: 'account-heart-outline',
    route: '/patient',
  },
];

export default function RoleSelectionScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const isWeb = Platform.OS === 'web';
  const scrollClassName = isWeb ? 'web:bg-card' : undefined;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className={cn('flex-1 bg-background', scrollClassName)}
    >
      <View className={cn('gap-6 px-6 pb-12 pt-10', isWeb && 'items-center py-16')}>
        <View className={cn('w-full max-w-4xl gap-2', isWeb && 'web:gap-4')}>
          <Text
            variant="title1"
            className={cn('font-semibold text-foreground', isWeb && 'text-4xl tracking-tight')}
          >
            {t('role_selection.title', { defaultValue: 'Select a workspace' })}
          </Text>
          <Text variant="body" color="tertiary" className={cn('leading-6', isWeb && 'text-lg')}>
            {t('role_selection.subtitle', {
              defaultValue:
                'Choose the clinician control center or the patient experience to see how Calico guides care teams and families.',
            })}
          </Text>
        </View>
        <View
          className={cn('w-full max-w-4xl gap-4', isWeb && 'web:grid web:grid-cols-2 web:gap-6')}
        >
          {ROLE_CARDS.map((role) => (
            <View
              key={role.key}
              className={cn(
                'gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm shadow-black/5 dark:border-border/60 dark:bg-card/95',
                isWeb &&
                  'web:rounded-3xl web:border-white/60 web:bg-white/95 web:p-8 web:shadow-lg web:shadow-primary/5 web:backdrop-blur-lg'
              )}
            >
              <View className="flex-row items-center gap-3">
                <View className="rounded-full bg-primary/10 p-3">
                  <Icon
                    materialCommunityIcon={{ name: role.icon }}
                    className="text-primary"
                    size={22}
                  />
                </View>
                <Text variant="title2" className="font-semibold text-foreground">
                  {t(role.titleKey, { defaultValue: role.fallbackTitle })}
                </Text>
              </View>
              <Text
                variant="body"
                color="tertiary"
                className={cn('leading-6', isWeb && 'text-base')}
              >
                {t(role.descriptionKey, { defaultValue: role.fallbackDescription })}
              </Text>
              <Button
                onPress={() => router.push(role.route)}
                className={cn('self-start px-6', isWeb && 'web:rounded-full web:px-8 web:py-3')}
              >
                <Text className="font-semibold text-white">
                  {t('role_selection.enter_view', {
                    role: t(`role_selection.roles.${role.key}`, {
                      defaultValue: role.fallbackRoleName,
                    }),
                    defaultValue: 'Enter view',
                  })}
                </Text>
              </Button>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
