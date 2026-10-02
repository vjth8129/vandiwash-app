import type { Ref } from 'react';
import { Pressable, StyleSheet, Text, type TextInput, type TextInputProps } from 'react-native';

import type { AccountIdentifier } from '@/api';
import { colors } from './theme';
import { TextField } from './ui';

export type AccountMode = 'phone' | 'username';

export function toAccountIdentifier(mode: AccountMode, value: string): AccountIdentifier {
  return mode === 'phone' ? { phone: value.trim() } : { username: value.trim() };
}

type Props = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  mode: AccountMode;
  onModeChange: (mode: AccountMode) => void;
  value: string;
  onChangeText: (value: string) => void;
  ref?: Ref<TextInput>;
};

/**
 * The "who are you" field for sign-in and password reset: a mobile number, with a switch to
 * username for older accounts that have no number on file.
 */
export function AccountField({ mode, onModeChange, value, onChangeText, ...props }: Props) {
  const isPhone = mode === 'phone';
  const switchMode = () => {
    onChangeText('');
    onModeChange(isPhone ? 'username' : 'phone');
  };
  return (
    <TextField
      key={mode} // remount so the keyboard type switches immediately
      label={isPhone ? 'Mobile number' : 'Username'}
      value={value}
      onChangeText={isPhone ? (t) => onChangeText(t.replace(/[^\d+\s-]/g, '')) : onChangeText}
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType={isPhone ? 'phone-pad' : 'default'}
      autoComplete={isPhone ? 'tel' : 'username'}
      textContentType={isPhone ? 'telephoneNumber' : 'username'}
      placeholder={isPhone ? 'e.g. 98765 43210' : 'e.g. staff'}
      maxLength={isPhone ? 18 : 100}
      labelAccessory={
        <Pressable onPress={switchMode} hitSlop={10} accessibilityRole="button">
          <Text style={s.switch}>{isPhone ? 'Use username' : 'Use mobile number'}</Text>
        </Pressable>
      }
      {...props}
    />
  );
}

const s = StyleSheet.create({
  switch: { fontSize: 13, fontWeight: '600', color: colors.primary },
});
