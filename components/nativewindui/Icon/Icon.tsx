import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  SF_SYMBOLS_TO_MATERIAL_COMMUNITY_ICONS,
  SF_SYMBOLS_TO_MATERIAL_ICONS,
} from 'rn-icon-mapper';
import { useColorScheme } from '@/lib/useColorScheme';
import type { IconProps } from './types';

function Icon({
  name,
  materialCommunityIcon,
  materialIcon,
  sfSymbol: _sfSymbol,
  size = 24,
  color,
  accessibilityLabel,
  accessibilityRole = 'image',
  accessibilityHint,
  ...props
}: IconProps) {
  const { colors } = useColorScheme();
  const defaultColor = color ?? colors.foreground;

  const accessibilityProps = {
    accessibilityLabel,
    accessibilityRole: accessibilityRole === 'none' ? undefined : accessibilityRole,
    accessibilityHint,
  };

  if (materialCommunityIcon) {
    return (
      <MaterialCommunityIcons
        size={size}
        color={defaultColor}
        {...accessibilityProps}
        {...props}
        {...materialCommunityIcon}
      />
    );
  }
  if (materialIcon) {
    return (
      <MaterialIcons
        size={size}
        color={defaultColor}
        {...accessibilityProps}
        {...props}
        {...materialIcon}
      />
    );
  }
  const materialCommunityIconName =
    SF_SYMBOLS_TO_MATERIAL_COMMUNITY_ICONS[
      name as keyof typeof SF_SYMBOLS_TO_MATERIAL_COMMUNITY_ICONS
    ];
  if (materialCommunityIconName) {
    return (
      <MaterialCommunityIcons
        name={materialCommunityIconName}
        size={size}
        color={defaultColor}
        {...accessibilityProps}
        {...props}
      />
    );
  }
  const materialIconName =
    SF_SYMBOLS_TO_MATERIAL_ICONS[name as keyof typeof SF_SYMBOLS_TO_MATERIAL_ICONS];
  if (materialIconName) {
    return (
      <MaterialIcons
        name={materialIconName}
        size={size}
        color={defaultColor}
        {...accessibilityProps}
        {...props}
      />
    );
  }
  return (
    <MaterialCommunityIcons
      name="help"
      size={size}
      color={defaultColor}
      {...accessibilityProps}
      {...props}
    />
  );
}

export { Icon };
