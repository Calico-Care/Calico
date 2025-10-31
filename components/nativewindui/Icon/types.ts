import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { SymbolViewProps } from 'expo-symbols';
import type { IconMapper } from 'rn-icon-mapper';

type MaterialCommunityIconsProps = React.ComponentProps<typeof MaterialCommunityIcons>;
type MaterialIconsProps = React.ComponentProps<typeof MaterialIcons>;
type MaterialCommunityIconName = MaterialCommunityIconsProps['name'];

type Style = SymbolViewProps['style'] &
  MaterialIconsProps['style'] &
  MaterialCommunityIconsProps['style'];

type IconMapperProps = IconMapper<SymbolViewProps, MaterialIconsProps, MaterialCommunityIconsProps>;

type MaterialCommunityOnly = {
  name?: undefined;
  sfSymbol?: undefined;
  materialIcon?: undefined;
  materialCommunityIcon: MaterialCommunityIconsProps;
};

type MaterialOnly = {
  name?: undefined;
  sfSymbol?: undefined;
  materialCommunityIcon?: undefined;
  materialIcon: MaterialIconsProps;
};

/**
 * Props for the Icon component. The Icon supports three mutually exclusive variants:
 *
 * 1. **IconMapperProps** (via `name` or `sfSymbol`): Use when you want SF Symbols that automatically
 *    map to Material icons. Provides cross-platform icon support with automatic mapping.
 *    - Use `name` prop with an SF Symbol name (e.g., "heart.fill", "checkmark.circle")
 *    - The Icon component will automatically map SF Symbols to equivalent Material icons
 *    - Best for: Cross-platform apps that need consistent icon semantics
 *
 *    @example
 *    ```tsx
 *    <Icon name="heart.fill" size={24} />
 *    <Icon sfSymbol="checkmark.circle" size={20} />
 *    ```
 *
 * 2. **MaterialCommunityOnly**: Use when you explicitly need Material Community Icons.
 *    - Must provide `materialCommunityIcon` prop with the icon name
 *    - Cannot use `name`, `sfSymbol`, or `materialIcon` (must be undefined)
 *    - Best for: When you specifically need Material Community Icons and their extensive icon set
 *
 *    @example
 *    ```tsx
 *    <Icon materialCommunityIcon={{ name: "stethoscope" }} size={24} />
 *    <Icon materialCommunityIcon={{ name: "account-heart-outline" }} size={20} />
 *    ```
 *
 * 3. **MaterialOnly**: Use when you explicitly need Material Icons (standard Material Design icons).
 *    - Must provide `materialIcon` prop with the icon name
 *    - Cannot use `name`, `sfSymbol`, or `materialCommunityIcon` (must be undefined)
 *    - Best for: When you specifically need standard Material Design icons
 *
 *    @example
 *    ```tsx
 *    <Icon materialIcon={{ name: "favorite" }} size={24} />
 *    <Icon materialIcon={{ name: "check-circle" }} size={20} />
 *    ```
 *
 * **Shared fields** (available on all variants):
 * - `style?: Style` - Inline styles for the icon
 * - `className?: string` - NativeWind/Tailwind classes for styling
 * - `size?: number` - Icon size in pixels (default: 24)
 * - `color?: string` - Icon color (defaults to theme foreground color)
 * - `accessibilityLabel?: string` - Screen reader label
 * - `accessibilityRole?: 'image' | 'none' | 'button'` - Accessibility role (default: 'image')
 * - `accessibilityHint?: string` - Additional accessibility context
 *
 * **Mutually exclusive fields**: Only one of the following should be provided:
 * - `name` / `sfSymbol` (IconMapperProps) OR
 * - `materialCommunityIcon` (MaterialCommunityOnly) OR
 * - `materialIcon` (MaterialOnly)
 *
 * @see Icon for the component implementation
 */
type IconProps = (IconMapperProps | MaterialCommunityOnly | MaterialOnly) & {
  style?: Style;
  className?: string;
  size?: number;
  color?: string;
  accessibilityLabel?: string;
  accessibilityRole?: 'image' | 'none' | 'button';
  accessibilityHint?: string;
};

export type { IconProps, MaterialCommunityIconName };
