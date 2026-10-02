import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ComponentProps, type PropsWithChildren, type ReactNode, type Ref } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { colors, radius, space } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---- Button -----------------------------------------------------------------

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
}: ButtonProps) {
  const palette = {
    primary: { bg: colors.primary, fg: '#fff', border: colors.primary },
    secondary: { bg: colors.card, fg: colors.primary, border: colors.primary },
    danger: { bg: colors.card, fg: colors.danger, border: colors.danger },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && { opacity: 0.8 },
        inactive && { opacity: 0.5 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Ionicons name={icon} size={18} color={palette.fg} style={{ marginRight: 6 }} />}
          <Text style={[styles.buttonText, { color: palette.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ---- Inputs -----------------------------------------------------------------

type FieldProps = TextInputProps & {
  label: string;
  error?: string | null;
  hint?: string;
  ref?: Ref<TextInput>;
  /** Rendered inside the input on the right, vertically centred (e.g. an icon button). */
  trailing?: ReactNode;
  /** Rendered at the right end of the label row (e.g. a small link). */
  labelAccessory?: ReactNode;
};

const TRAILING_WIDTH = 48;

export function TextField({ label, error, hint, style, ref, trailing, labelAccessory, ...props }: FieldProps) {
  return (
    <View style={{ marginBottom: space.md }}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {labelAccessory}
      </View>
      <View>
        <TextInput
          ref={ref}
          placeholderTextColor="#98A2B3"
          style={[
            styles.input,
            error ? { borderColor: colors.danger } : null,
            trailing ? { paddingRight: TRAILING_WIDTH } : null,
            style,
          ]}
          {...props}
        />
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

/** Password input with a show/hide toggle. */
export function PasswordField(props: Omit<FieldProps, 'secureTextEntry' | 'trailing'>) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
      secureTextEntry={!visible}
      trailing={
        <Pressable
          onPress={() => setVisible((v) => !v)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          style={({ pressed }) => [styles.trailingButton, pressed && { opacity: 0.5 }]}>
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted} />
        </Pressable>
      }
    />
  );
}

export function SearchBar(props: TextInputProps) {
  return (
    <View style={styles.search}>
      <Ionicons name="search" size={18} color={colors.muted} />
      <TextInput
        placeholderTextColor="#98A2B3"
        autoCorrect={false}
        clearButtonMode="while-editing"
        style={styles.searchInput}
        {...props}
      />
    </View>
  );
}

// ---- Layout -----------------------------------------------------------------

export function Card({
  children,
  style,
  onPress,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle>; onPress?: () => void }>) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: PropsWithChildren<{ right?: ReactNode }>) {
  return (
    <View style={[styles.row, { justifyContent: 'space-between', marginBottom: space.sm }]}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function Row({ icon, label, value }: { icon: IconName; label: string; value?: ReactNode }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={colors.muted} style={{ width: 26 }} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value ?? '—'}
      </Text>
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map(([key, label]) => (
        <Text
          key={key}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === key }}
          onPress={() => onChange(key)}
          style={[styles.segmentItem, value === key && styles.segmentActive]}
          numberOfLines={1}>
          {label}
        </Text>
      ))}
    </View>
  );
}

// ---- Status / feedback ------------------------------------------------------

export function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  count,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  count?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
      <Text style={[styles.chipText, selected && { color: '#fff' }]}>
        {label}
        {count !== undefined ? ` · ${count}` : ''}
      </Text>
    </Pressable>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorBanner}>
      <Ionicons name="alert-circle" size={18} color={colors.danger} />
      <Text style={styles.errorBannerText}>{message}</Text>
      {onRetry && (
        <Text style={styles.retry} onPress={onRetry}>
          Retry
        </Text>
      )}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: IconName;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={44} color="#B4BECB" />
      <Text style={styles.emptyTitle}>{title}</Text>
      {message && <Text style={styles.emptyMessage}>{message}</Text>}
      {action && <View style={{ marginTop: space.lg, alignSelf: 'stretch' }}>{action}</View>}
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

// ---- Floating action button -------------------------------------------------

export function Fab({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}>
      <Ionicons name={icon} size={22} color="#fff" />
      <Text style={styles.fabText}>{label}</Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 6 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  trailing: { position: 'absolute', top: 0, bottom: 0, right: 0, width: TRAILING_WIDTH },
  trailingButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 12, color: colors.muted, marginTop: 4 },
  errorText: { fontSize: 12, color: colors.danger, marginTop: 4 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 16, color: colors.text },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  infoLabel: { color: colors.muted, fontSize: 14, width: 90 },
  infoValue: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '500', textAlign: 'right' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#E4E9F0',
    borderRadius: 12,
    padding: 3,
    marginBottom: space.md,
  },
  segmentItem: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: 8,
    fontWeight: '600',
    color: colors.muted,
    borderRadius: 10,
    overflow: 'hidden',
    fontSize: 13,
  },
  segmentActive: { backgroundColor: colors.card, color: colors.text },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.text },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.dangerSoft,
    padding: space.md,
    borderRadius: radius.md,
    marginBottom: space.md,
  },
  errorBannerText: { flex: 1, color: colors.danger, fontSize: 14 },
  retry: { color: colors.primary, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: space.xl },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: space.md },
  emptyMessage: { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 6 },
  fab: {
    position: 'absolute',
    right: space.lg,
    bottom: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: radius.pill,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
