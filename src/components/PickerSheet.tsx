import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space } from './theme';
import { SearchBar, styles as ui } from './ui';

export type PickerOption = { value: string; label: string; tag?: string };

type Props = {
  visible: boolean;
  title: string;
  searchPlaceholder: string;
  options: readonly PickerOption[];
  selected?: string;
  onPick: (value: string) => void;
  onClose: () => void;
  /** Offer "Use “<search text>”" for values that aren't in the list. */
  allowCustom?: boolean;
};

/** Bottom sheet with a search box and a tappable list; matches on the tag's start or anywhere in the label. */
export function PickerSheet({ visible, title, searchPlaceholder, options, selected, onPick, onClose, allowCustom }: Props) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const matches = q
    ? options.filter((o) => o.tag?.toLowerCase().startsWith(q) || o.label.toLowerCase().includes(q))
    : options;
  const custom = allowCustom && q && !options.some((o) => o.label.toLowerCase() === q) ? search.trim() : null;

  const close = () => {
    setSearch('');
    onClose();
  };
  const pick = (value: string) => {
    setSearch('');
    onPick(value);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={s.backdrop} onPress={close} />
      <View style={s.sheet}>
        <View style={[ui.row, { justifyContent: 'space-between', marginBottom: space.md }]}>
          <Text style={s.title}>{title}</Text>
          <Ionicons name="close" size={24} color={colors.muted} onPress={close} />
        </View>
        <SearchBar value={search} onChangeText={setSearch} placeholder={searchPlaceholder} autoCapitalize="none" />
        <FlatList
          data={matches}
          keyExtractor={(o) => o.value}
          keyboardShouldPersistTaps="handled"
          style={{ marginTop: space.sm }}
          ListFooterComponent={
            custom ? (
              <Pressable onPress={() => pick(custom)} style={({ pressed }) => [s.item, pressed && { opacity: 0.6 }]}>
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={[s.label, { color: colors.primary, fontWeight: '700' }]}>Use “{custom}”</Text>
              </Pressable>
            ) : null
          }
          ListEmptyComponent={
            custom ? null : (
              <Text style={s.empty}>{q ? `Nothing matches “${search.trim()}”.` : 'Type a name in the search box.'}</Text>
            )
          }
          renderItem={({ item }) => {
            const isSelected = item.value === selected;
            return (
              <Pressable onPress={() => pick(item.value)} style={({ pressed }) => [s.item, pressed && { opacity: 0.6 }]}>
                {item.tag !== undefined && <Text style={[s.tag, isSelected && { color: colors.primary }]}>{item.tag}</Text>}
                <Text style={[s.label, isSelected && { color: colors.primary, fontWeight: '700' }]}>{item.label}</Text>
                {isSelected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

/** A form field that looks like a text input but opens a picker. */
export function SelectField({
  label,
  value,
  placeholder,
  onPress,
  disabled,
}: {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={ui.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}`}
        onPress={onPress}
        disabled={disabled}
        style={[ui.input, s.select, disabled && { opacity: 0.5 }]}>
        <Text style={[s.selectText, !value && { color: '#98A2B3' }]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.muted} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,27,45,0.4)' },
  sheet: {
    height: '75%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
    paddingBottom: space.xl,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tag: { width: 36, fontSize: 16, fontWeight: '800', color: colors.text },
  label: { flex: 1, fontSize: 15, color: colors.text },
  empty: { padding: space.lg, textAlign: 'center', color: colors.muted },
  select: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  selectText: { flex: 1, fontSize: 16, color: colors.text },
});
