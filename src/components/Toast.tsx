import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, space } from './theme';

type Kind = 'error' | 'success' | 'info';
type Action = { label: string; onPress: () => void };
type Toast = { id: number; kind: Kind; title?: string; message: string; action?: Action };

// A tiny global store so toasts can be raised from anywhere (hooks, API helpers, event handlers).
let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<(t: Toast[]) => void>();
const emit = () => listeners.forEach((l) => l(toasts));

const MAX_VISIBLE = 3;
const DURATION: Record<Kind, number> = { error: 5000, success: 3000, info: 4000 };

function show(kind: Kind, message: string, opts: { title?: string; action?: Action } = {}) {
  // The same message already on screen (e.g. a retry that failed again): restart it instead of stacking.
  const existing = toasts.find((t) => t.message === message && t.title === opts.title);
  if (existing) {
    toasts = toasts.filter((t) => t !== existing);
  }
  const t: Toast = { id: nextId++, kind, message, ...opts };
  toasts = [...toasts, t].slice(-MAX_VISIBLE);
  emit();
  setTimeout(() => dismiss(t.id), DURATION[kind] + (opts.action ? 2000 : 0));
  return t.id;
}

function dismiss(id: number) {
  if (!toasts.some((t) => t.id === id)) return;
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  error: (message: string, opts?: { title?: string; action?: Action }) => show('error', message, opts),
  success: (message: string, opts?: { title?: string }) => show('success', message, opts),
  info: (message: string, opts?: { title?: string; action?: Action }) => show('info', message, opts),
  dismiss,
};

/** Renders the toast stack; mount once at the app root, after the navigator. */
export function ToastHost() {
  const [items, setItems] = useState(toasts);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  if (items.length === 0) return null;
  return (
    <View pointerEvents="box-none" style={[s.host, { top: insets.top + space.sm }]}>
      {items.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </View>
  );
}

const ICON = { error: 'alert-circle', success: 'checkmark-circle', info: 'information-circle' } as const;
const ICON_COLOR = { error: '#FF8A80', success: '#7EE2B8', info: '#9CC3FF' };

function ToastItem({ toast: t }: { toast: Toast }) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [anim]);

  return (
    <Animated.View
      style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }}>
      <Pressable
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        onPress={() => dismiss(t.id)}
        style={[s.toast, t.kind === 'error' && s.error]}>
        <Ionicons name={ICON[t.kind]} size={20} color={ICON_COLOR[t.kind]} style={{ marginTop: 1 }} />
        <View style={{ flex: 1 }}>
          {t.title ? <Text style={s.title}>{t.title}</Text> : null}
          <Text style={s.message}>{t.message}</Text>
        </View>
        {t.action && (
          <Text
            accessibilityRole="button"
            style={s.action}
            onPress={() => {
              dismiss(t.id);
              t.action!.onPress();
            }}>
            {t.action.label}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  host: { position: 'absolute', left: space.md, right: space.md, gap: space.sm, zIndex: 1000, elevation: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    backgroundColor: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    boxShadow: '0 6px 16px rgba(0,0,0,0.22)',
  },
  error: { backgroundColor: '#3A1212' },
  title: { color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 2 },
  message: { color: '#fff', fontSize: 14, lineHeight: 19 },
  action: { color: '#9CC3FF', fontWeight: '800', fontSize: 14, paddingLeft: space.sm, marginTop: 1 },
});
