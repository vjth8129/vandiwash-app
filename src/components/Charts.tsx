import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space } from './theme';

// Small charts drawn with plain Views (no native chart library needed).

/** Categorical series colours in fixed order, assigned by entity (never by rank). */
export const SERIES = ['#2A78D6', '#EB6834', '#1BAF7A', '#EDA100', '#E87BA4', '#008300', '#6250D6', '#E34948'];
/** Everything past the eighth slice folds into this. */
export const OTHER_COLOR = '#A3ABB6';

/** Rounds an axis maximum up to 1, 2, 2.5 or 5 × a power of ten. */
function niceCeil(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

export type BarDatum = { key: string; tick: string; value: number };

/**
 * Vertical bar chart with a light grid. Tapping a bar selects it (the parent shows its details);
 * tapping it again clears the selection.
 */
export function BarChart({
  data,
  axis,
  selected,
  onSelect,
  height = 160,
}: {
  data: BarDatum[];
  /** Formats the y-axis labels. */
  axis: (n: number) => string;
  selected: number | null;
  onSelect: (index: number | null) => void;
  height?: number;
}) {
  const max = niceCeil(Math.max(0, ...data.map((d) => d.value)));
  // Keep about seven x labels whatever the number of bars.
  const every = Math.max(1, Math.ceil(data.length / 7));
  const gap = data.length > 20 ? 2 : 4;

  return (
    <View>
      <View style={{ flexDirection: 'row' }}>
        <View style={[c.yAxis, { height }]}>
          {[max, max / 2, 0].map((v) => (
            <Text key={v} style={c.axisText} numberOfLines={1}>
              {axis(v)}
            </Text>
          ))}
        </View>
        <View style={{ flex: 1, height }}>
          {[0, 0.5, 1].map((f) => (
            <View key={f} style={[c.grid, { top: f * (height - 1) }, f === 1 && c.baseline]} />
          ))}
          <View style={[c.bars, { gap }]}>
            {data.map((d, i) => {
              const active = selected === null || selected === i;
              return (
                <Pressable
                  key={d.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${d.tick}: ${d.value}`}
                  onPress={() => onSelect(selected === i ? null : i)}
                  style={c.barSlot}>
                  <View
                    style={[
                      c.bar,
                      {
                        height: `${(d.value / max) * 100}%`,
                        minHeight: d.value > 0 ? 3 : 0,
                        backgroundColor: active ? colors.primary : '#B7CEF5',
                      },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
      <View style={[c.ticks, { marginLeft: Y_AXIS }]}>
        {data.map((d, i) =>
          i % every === 0 || selected === i ? (
            <Text
              key={d.key}
              style={[
                c.tick,
                { left: `${((i + 0.5) / data.length) * 100}%` },
                selected === i && { color: colors.text, fontWeight: '700' },
              ]}
              numberOfLines={1}>
              {d.tick}
            </Text>
          ) : null,
        )}
      </View>
    </View>
  );
}

export type Slice = { key: string; label: string; value: number; sub?: string; color: string };

/**
 * One stacked bar showing each slice's share, with a legend row per slice underneath
 * (colour dot, name, figures, share). Rows are tappable when `onPress` is given.
 */
export function ShareBreakdown({
  slices,
  format,
  onPress,
  selectedKey,
}: {
  slices: Slice[];
  format: (n: number) => string;
  onPress?: (slice: Slice) => void;
  selectedKey?: string | null;
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (!slices.length) return null;
  return (
    <View>
      <View style={c.stack}>
        {slices
          .filter((s) => s.value > 0)
          .map((s) => (
            <View key={s.key} style={{ flex: s.value, backgroundColor: s.color }} />
          ))}
      </View>
      {slices.map((s) => {
        const pct = total ? Math.round((s.value / total) * 100) : 0;
        const selected = selectedKey === s.key;
        return (
          <Pressable
            key={s.key}
            disabled={!onPress || s.key === OTHER_KEY}
            onPress={() => onPress?.(s)}
            accessibilityRole={onPress ? 'button' : undefined}
            style={({ pressed }) => [c.legendRow, (pressed || selected) && { backgroundColor: colors.primarySoft }]}>
            <View style={[c.dot, { backgroundColor: s.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={c.legendLabel} numberOfLines={1}>
                {s.label}
              </Text>
              {s.sub ? <Text style={c.legendSub}>{s.sub}</Text> : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={c.legendValue}>{format(s.value)}</Text>
              <Text style={c.legendSub}>{pct}%</Text>
            </View>
            {onPress && s.key !== OTHER_KEY && (
              <Ionicons name={selected ? 'close-circle' : 'chevron-forward'} size={16} color={colors.muted} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export const OTHER_KEY = '__other__';

const Y_AXIS = 44;

const c = StyleSheet.create({
  yAxis: { width: Y_AXIS, justifyContent: 'space-between', paddingRight: 6, marginTop: -6, marginBottom: -6 },
  axisText: { fontSize: 10, color: colors.muted, textAlign: 'right' },
  grid: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#EEF1F5' },
  baseline: { backgroundColor: colors.border },
  bars: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end' },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  ticks: { height: 14, marginTop: 6 },
  tick: { position: 'absolute', width: 44, marginLeft: -22, fontSize: 10, color: colors.muted, textAlign: 'center' },
  stack: {
    flexDirection: 'row',
    height: 12,
    borderRadius: radius.pill,
    overflow: 'hidden',
    gap: 2,
    marginBottom: space.sm,
    backgroundColor: colors.primarySoft,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.xs,
    borderRadius: radius.sm,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  legendValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  legendSub: { fontSize: 12, color: colors.muted },
});
