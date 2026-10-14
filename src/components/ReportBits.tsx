import { StyleSheet, Text } from 'react-native';

import { colors } from './theme';
import { Card } from './ui';

// The blue headline card used by the Today report and the Analytics screen.

/** "▲ 12%" against the previous period; nothing when there's nothing to compare with. */
export function Delta({ value, onDark = true }: { value: number | null; onDark?: boolean }) {
  if (value === null) return null;
  const up = value >= 0;
  const color = onDark ? (up ? '#B9F5D8' : '#FFD1D1') : up ? colors.success : colors.danger;
  return (
    <Text style={[s.delta, { color }]}>
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(0)}%
    </Text>
  );
}

export function SummaryCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card style={s.summary}>
      <Text style={s.summaryLabel}>{subtitle}</Text>
      <Text style={s.summaryTitle}>{title}</Text>
      {children}
    </Card>
  );
}

const s = StyleSheet.create({
  summary: { backgroundColor: colors.primary, borderColor: colors.primary },
  summaryLabel: { color: '#DCE8FF', fontSize: 13, fontWeight: '600' },
  summaryTitle: { color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 2 },
  delta: { fontSize: 12, fontWeight: '700', marginTop: 2 },
});
