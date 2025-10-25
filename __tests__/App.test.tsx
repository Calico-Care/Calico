import { render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

describe('App smoke test', () => {
  it('renders Calico banner', () => {
    const { getByText } = render(<Text>Calico</Text>);
    expect(getByText('Calico')).toBeTruthy();
  });
});
