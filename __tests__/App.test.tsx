import { fireEvent, render } from '@testing-library/react-native';

import { Button } from '@/components/nativewindui/Button';
import { Text } from '@/components/nativewindui/Text';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

describe('NativeWind UI Button', () => {
  it('renders text children and supports press events', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Button onPress={onPress}>
        <Text>Tap me</Text>
      </Button>
    );

    const label = getByText('Tap me');
    fireEvent.press(label);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('NativeWind Text', () => {
  it('renders variant text content', () => {
    const { getByText } = render(<Text variant="title1">Primary Copy</Text>);
    expect(getByText('Primary Copy')).toBeTruthy();
  });
});
