import { Platform, View } from 'react-native';
import { Text } from '@/components/nativewindui/Text';

type LiveRegionProps = {
  message: string;
  level?: 'polite' | 'assertive';
  id?: string;
};

export function LiveRegion({ message, level = 'polite', id }: LiveRegionProps) {
  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <View
      {...({
        'aria-live': level,
        'aria-atomic': 'true',
        id,
        className: 'sr-only',
      } as any)}
      accessibilityRole="text"
    >
      <Text className="sr-only">{message}</Text>
    </View>
  );
}
