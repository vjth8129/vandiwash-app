import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PLATE_FORMATS_HINT, PLATE_STATES, type PlateParts } from '@/lib/plates';
import { PickerSheet } from './PickerSheet';
import { colors, space } from './theme';
import { styles as ui } from './ui';

const STATE_OPTIONS = PLATE_STATES.map(([code, name]) => ({ value: code, label: name, tag: code }));

type Props = {
  label: string;
  value: PlateParts;
  onChange: (value: PlateParts) => void;
  error?: string | null;
};

/**
 * Vehicle number in four parts: searchable state code · district (07) · series (AB) · number (1234).
 * "Enter manually" swaps to one free-text box, e.g. for Bharat series plates (25 BH 0345 CD).
 */
export function VehicleNumberInput({ label, value, onChange, error }: Props) {
  const [picking, setPicking] = useState(false);
  const districtRef = useRef<TextInput>(null);
  const seriesRef = useRef<TextInput>(null);
  const numberRef = useRef<TextInput>(null);
  const manualRef = useRef<TextInput>(null);

  const pick = (state: string) => {
    onChange({ ...value, state });
    setPicking(false);
    setTimeout(() => districtRef.current?.focus(), 300);
  };

  const manual = value.manual !== null;
  const toggleManual = () => {
    if (manual) {
      onChange({ ...value, manual: null });
      setTimeout(() => districtRef.current?.focus(), 100);
    } else {
      // Carry over whatever was already typed in the boxes.
      const typed = value.district || value.series || value.number;
      onChange({ ...value, manual: typed ? [value.state, value.district, value.series, value.number].filter(Boolean).join(' ') : '' });
      setTimeout(() => manualRef.current?.focus(), 100);
    }
  };

  const border = error ? { borderColor: colors.danger } : null;

  return (
    <View style={{ marginBottom: space.md }}>
      <View style={[ui.row, { justifyContent: 'space-between' }]}>
        <Text style={ui.label}>{label}</Text>
        <Pressable accessibilityRole="button" onPress={toggleManual} hitSlop={8} style={[ui.row, s.toggle]}>
          <Ionicons name={manual ? 'grid-outline' : 'create-outline'} size={14} color={colors.primary} />
          <Text style={s.toggleText}>{manual ? 'Use KL 07 AB 1234 boxes' : 'Enter manually'}</Text>
        </Pressable>
      </View>

      {manual ? (
        <TextInput
          ref={manualRef}
          value={value.manual ?? ''}
          onChangeText={(t) => onChange({ ...value, manual: t.toUpperCase() })}
          placeholder="e.g. 25 BH 0345 CD"
          placeholderTextColor="#98A2B3"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={20}
          accessibilityLabel="Vehicle number"
          style={[ui.input, s.manual, border]}
        />
      ) : (
        <View style={s.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`State ${value.state}, change`}
            onPress={() => setPicking(true)}
            style={[ui.input, s.state, border]}>
            <Text style={s.stateText}>{value.state}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.muted} />
          </Pressable>
          <TextInput
            ref={districtRef}
            value={value.district}
            onChangeText={(t) => {
              const district = t.replace(/\D/g, '');
              onChange({ ...value, district });
              if (district.length === 2) seriesRef.current?.focus();
            }}
            placeholder="07"
            placeholderTextColor="#98A2B3"
            keyboardType="number-pad"
            maxLength={2}
            accessibilityLabel="District code"
            style={[ui.input, s.part, border]}
          />
          <TextInput
            ref={seriesRef}
            value={value.series}
            onChangeText={(t) => onChange({ ...value, series: t.toUpperCase().replace(/[^A-Z]/g, '') })}
            placeholder="AB"
            placeholderTextColor="#98A2B3"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={3}
            returnKeyType="next"
            onSubmitEditing={() => numberRef.current?.focus()}
            submitBehavior="submit"
            accessibilityLabel="Series letters"
            style={[ui.input, s.part, border]}
          />
          <TextInput
            ref={numberRef}
            value={value.number}
            onChangeText={(t) => onChange({ ...value, number: t.replace(/\D/g, '') })}
            placeholder="1234"
            placeholderTextColor="#98A2B3"
            keyboardType="number-pad"
            maxLength={4}
            accessibilityLabel="Number"
            style={[ui.input, s.part, s.number, border]}
          />
        </View>
      )}
      {error ? (
        <Text style={ui.errorText}>{error}</Text>
      ) : manual ? (
        <Text style={ui.hint}>{PLATE_FORMATS_HINT}</Text>
      ) : null}

      <PickerSheet
        visible={picking}
        title="Select state"
        searchPlaceholder="Search state or code"
        options={STATE_OPTIONS}
        selected={value.state}
        onPick={pick}
        onClose={() => setPicking(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  state: {
    width: 72,
    paddingHorizontal: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stateText: { fontSize: 16, fontWeight: '700', color: colors.text, letterSpacing: 0.5 },
  part: { flex: 1, minWidth: 0, paddingHorizontal: space.sm, textAlign: 'center', fontWeight: '600', letterSpacing: 1 },
  number: { flex: 1.4 },
  manual: { fontWeight: '600', letterSpacing: 1 },
  toggle: { gap: 4, marginBottom: 6 },
  toggleText: { fontSize: 13, fontWeight: '700', color: colors.primary },
});
