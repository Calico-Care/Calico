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

type IconProps = (IconMapperProps | MaterialCommunityOnly | MaterialOnly) & {
  style?: Style;
  className?: string;
  size?: number;
  color?: string;
};

export type { IconProps, MaterialCommunityIconName };
