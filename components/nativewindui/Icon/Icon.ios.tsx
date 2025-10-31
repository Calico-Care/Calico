import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView } from 'expo-symbols';
import {
  SF_SYMBOLS_TO_MATERIAL_COMMUNITY_ICONS,
  SF_SYMBOLS_TO_MATERIAL_ICONS,
} from 'rn-icon-mapper';
import { useColorScheme } from '@/lib/useColorScheme';
import type { IconProps } from './types';

function Icon({
  materialCommunityIcon,
  materialIcon,
  sfSymbol,
  name,
  color,
  size = 24,
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

  // If materialCommunityIcon is provided, use MaterialCommunityIcons (consistent with web/android)
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

  // If materialIcon is provided, use MaterialIcons (consistent with web/android)
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

  // If sfSymbol is explicitly provided, use SF Symbols (iOS native)
  if (sfSymbol && name) {
    return (
      <SymbolView
        name={name}
        tintColor={rgbaToHex(defaultColor)}
        size={size}
        resizeMode="scaleAspectFit"
        {...accessibilityProps}
        {...props}
        {...sfSymbol}
      />
    );
  }

  // Try to map SF Symbol name to Material icon for consistency
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

  // Fallback: if name is provided but not mapped, use SF Symbols (iOS native)
  if (name) {
    return (
      <SymbolView
        name={name}
        tintColor={rgbaToHex(defaultColor)}
        size={size}
        resizeMode="scaleAspectFit"
        {...accessibilityProps}
        {...props}
        {...sfSymbol}
      />
    );
  }

  // Final fallback
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

// TODO: seems like the need to convert rgba to hex color is a bug in expo-symbols, accordion to the docs, it should accept a hex color, but it doesn't.

function rgbaToHex(color: string): string {
  if (!color) return 'black';
  const rgbaRegex =
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(\d*\.?\d+))?\s*\)$/i;
  const match = color.match(rgbaRegex);

  if (!match) {
    return color;
  }

  const [, rStr, gStr, bStr, aStr] = match;
  const r = Math.min(255, parseInt(rStr, 10));
  const g = Math.min(255, parseInt(gStr, 10));
  const b = Math.min(255, parseInt(bStr, 10));
  const a = aStr !== undefined ? Math.round(parseFloat(aStr) * 255) : 255;

  const toHex = (n: number) => n.toString(16).padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b)}${a < 255 ? toHex(a) : ''}`;
}
