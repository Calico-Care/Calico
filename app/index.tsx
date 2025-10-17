import { useHeaderHeight } from '@react-navigation/elements';
import { FlashList } from '@shopify/flash-list';
import { cssInterop } from 'nativewind';
import * as React from 'react';
import { Linking, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SearchBarProps } from 'react-native-screens';
import * as Sentry from '@sentry/react-native';

import { useNavigation } from '@react-navigation/native';

import * as Haptics from 'expo-haptics';

import { Button } from '@/components/nativewindui/Button';

import { Icon } from '@/components/nativewindui/Icon';

import { Text } from '@/components/nativewindui/Text';

import { useColorScheme } from '@/lib/useColorScheme';

cssInterop(FlashList, {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
});

export default function Screen() {
  const searchValue = useHeaderSearchBar({ hideWhenScrolling: COMPONENTS.length === 0 });

  const data = searchValue
    ? COMPONENTS.filter((c) => c.name.toLowerCase().includes(searchValue.toLowerCase()))
    : COMPONENTS;

  return (
    <FlashList
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      data={data}
      contentContainerClassName="py-4 android:pb-12"
      extraData={searchValue}
      removeClippedSubviews={false} // used for slecting text on android
      keyExtractor={keyExtractor}
      ItemSeparatorComponent={renderItemSeparator}
      renderItem={renderItem}
      ListEmptyComponent={COMPONENTS.length === 0 ? ListEmptyComponent : undefined}
    />
  );
}

function useHeaderSearchBar(props: SearchBarProps = {}) {
  const { colorScheme, colors } = useColorScheme();
  const navigation = useNavigation();
  const [search, setSearch] = React.useState('');

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        placeholder: 'Search...',
        textColor: colors.foreground,
        tintColor: colors.primary,
        headerIconColor: colors.foreground,
        hintTextColor: colors.grey,
        hideWhenScrolling: false,
        onChangeText(ev) {
          setSearch(ev.nativeEvent.text);
        },
        ...props,
      } satisfies SearchBarProps,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, colorScheme]);

  return search;
}

function ListEmptyComponent() {
  const insets = useSafeAreaInsets();
  const dimensions = useWindowDimensions();
  const headerHeight = useHeaderHeight();
  const { colors } = useColorScheme();
  const height = dimensions.height - headerHeight - insets.bottom - insets.top;

  return (
    <View style={{ height }} className="flex-1 items-center justify-center gap-1 px-12">
      <Icon name="doc.badge.plus" size={42} color={colors.grey} />
      <Text variant="title3" className="pb-1 text-center font-semibold">
        No Components Installed
      </Text>
      <Text color="tertiary" variant="subhead" className="pb-4 text-center">
        You can install any of the free components from the{' '}
        <Text
          onPress={() => Linking.openURL('https://nativewindui.com')}
          variant="subhead"
          className="text-primary">
          NativewindUI
        </Text>
        {' website.'}
      </Text>
    </View>
  );
}

type ComponentItem = { name: string; component: React.FC };

function keyExtractor(item: ComponentItem) {
  return item.name;
}

function renderItemSeparator() {
  return <View className="p-2" />;
}

function renderItem({ item }: { item: ComponentItem }) {
  return (
    <Card title={item.name}>
      <item.component />
    </Card>
  );
}

function Card({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View className="px-4">
      <View className="gap-4 rounded-xl border border-border bg-card p-4 pb-6 shadow-sm shadow-black/10 dark:shadow-none">
        <Text className="text-center text-sm font-medium tracking-wider opacity-60">{title}</Text>
        {children}
      </View>
    </View>
  );
}

const COMPONENTS: ComponentItem[] = [
  {
    name: 'Sentry Test',
    component: function SentryTestButton() {
      function onPress() {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Sentry.captureException(new Error('First error'));
      }
      return (
        <View className="items-center justify-center gap-4 p-4">
          <Button onPress={onPress}>
            <Text>Try!</Text>
          </Button>
          <Text variant="footnote" color="tertiary" className="text-center">
            Tap to send a test error to Sentry
          </Text>
        </View>
      );
    },
  },
  // {
  //   name: 'Button',
  //   component: function ButtonExample() {
  //     function onPress() {
  //       Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  //     }
  //     return (
  //       <View className="items-center justify-center gap-4 p-4">
  //         <Button onPress={onPress}>
  //           <Icon name="play.fill" className="ios:size-4 text-white" />
  //           <Text>Primary</Text>
  //         </Button>
  //         <Button onPress={onPress} variant="secondary">
  //           <Text>Secondary</Text>
  //         </Button>
  //         <Button onPress={onPress} variant="tonal">
  //           <Text>Tonal</Text>
  //         </Button>
  //         <Button onPress={onPress} variant="plain">
  //           <Text>Plain</Text>
  //         </Button>
  //         <Button onPress={onPress} variant="tonal" size="icon">
  //           <Icon name="heart.fill" className="ios:text-primary size-5 text-foreground" />
  //         </Button>
  //       </View>
  //     );
  //   },
  // },
  //   {
  //    name: 'Text',
  //     component: function TextExample() {
  //       return (
  //        <View className="gap-2">
  //          <Text variant="largeTitle" className="text-center">
  //            Large Title
  //          </Text>
  //          <Text variant="title1" className="text-center">
  //            Title 1
  //          </Text>
  //          <Text variant="title2" className="text-center">
  //            Title 2
  //          </Text>
  //          <Text variant="title3" className="text-center">
  //            Title 3
  //          </Text>
  //          <Text variant="heading" className="text-center">
  //            Heading
  //          </Text>
  //          <Text variant="body" className="text-center">
  //            Body
  //          </Text>
  //          <Text variant="callout" className="text-center">
  //            Callout
  //          </Text>
  //          <Text variant="subhead" className="text-center">
  //            Subhead
  //          </Text>
  //          <Text variant="footnote" className="text-center">
  //            Footnote
  //          </Text>
  //          <Text variant="caption1" className="text-center">
  //            Caption 1
  //          </Text>
  //          <Text variant="caption2" className="text-center">
  //            Caption 2
  //          </Text>
  //         </View>
  //       );
  //     },
  //   },
];
