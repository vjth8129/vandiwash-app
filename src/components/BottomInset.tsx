import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from './theme';

/**
 * Android draws apps edge-to-edge, so a stack screen's content runs under the system
 * navigation bar and its last button (e.g. "Cancel job") can't be reached. Wrap stack
 * screens in this to keep content above the bar. Tab screens don't need it - the tab
 * bar already reserves that space.
 */
export function BottomInset({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  return <View style={{ flex: 1, paddingBottom: insets.bottom, backgroundColor: colors.bg }}>{children}</View>;
}
