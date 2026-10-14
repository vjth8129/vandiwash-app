import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { toDateString } from '@/lib/format';
import { isValidDate, MAX_WEEKS, PERIODS, periodRange, type DateRange, type Period } from '@/lib/report';
import { colors, radius, space } from './theme';
import { Chip, TextField } from './ui';

export type PeriodState = ReturnType<typeof usePeriod>;

/** The report period: a preset, the last N weeks, or a custom From–To range. */
export function usePeriod(initial: { period?: Period; weeks?: number; from?: string; to?: string } = {}) {
  const [period, setPeriod] = useState<Period>(initial.period ?? 'weeks');
  const [weeks, setWeeks] = useState(initial.weeks ?? 4);
  const [customFrom, setCustomFrom] = useState(() => initial.from ?? periodRange('month').from);
  const [customTo, setCustomTo] = useState(() => initial.to ?? toDateString(new Date()));

  const customError =
    period !== 'custom'
      ? null
      : !isValidDate(customFrom) || !isValidDate(customTo)
        ? 'Use dates like 2026-09-01'
        : customFrom > customTo
          ? 'Must be after “From”'
          : null;
  const range: DateRange =
    period === 'custom'
      ? customError
        ? periodRange('month')
        : { from: customFrom, to: customTo }
      : periodRange(period, weeks);

  return { period, setPeriod, weeks, setWeeks, customFrom, setCustomFrom, customTo, setCustomTo, customError, range };
}

export function PeriodPicker({ state }: { state: PeriodState }) {
  const { period, setPeriod, weeks, setWeeks, customFrom, setCustomFrom, customTo, setCustomTo, customError } = state;
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {PERIODS.map(([key, label]) => (
          <Chip
            key={key}
            label={key === 'weeks' ? `Last ${weeks} weeks` : label}
            selected={period === key}
            onPress={() => setPeriod(key)}
          />
        ))}
      </ScrollView>

      {period === 'weeks' && (
        <View style={s.stepper}>
          <Text style={s.stepperLabel}>Weeks</Text>
          <StepButton icon="remove" disabled={weeks <= 1} onPress={() => setWeeks(weeks - 1)} label="Fewer weeks" />
          <Text style={s.stepperValue}>{weeks}</Text>
          <StepButton icon="add" disabled={weeks >= MAX_WEEKS} onPress={() => setWeeks(weeks + 1)} label="More weeks" />
        </View>
      )}

      {period === 'custom' && (
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <TextField
              label="From"
              value={customFrom}
              onChangeText={setCustomFrom}
              placeholder="2026-09-01"
              maxLength={10}
              keyboardType="numbers-and-punctuation"
              error={isValidDate(customFrom) ? null : 'Use YYYY-MM-DD'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              label="To"
              value={customTo}
              onChangeText={setCustomTo}
              placeholder="2026-09-30"
              maxLength={10}
              keyboardType="numbers-and-punctuation"
              error={!isValidDate(customTo) ? 'Use YYYY-MM-DD' : customError}
            />
          </View>
        </View>
      )}
    </View>
  );
}

function StepButton({ icon, onPress, disabled, label }: { icon: 'add' | 'remove'; onPress: () => void; disabled: boolean; label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [s.stepButton, (pressed || disabled) && { opacity: disabled ? 0.35 : 0.7 }]}>
      <Ionicons name={icon} size={18} color={colors.primary} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  chips: { gap: space.sm, paddingBottom: space.md },
  row: { flexDirection: 'row', gap: space.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  stepperLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.muted },
  stepperValue: { fontSize: 18, fontWeight: '800', color: colors.text, minWidth: 24, textAlign: 'center' },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
