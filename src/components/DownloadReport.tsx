import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_BASE_URL, errorMessage, reportsApi, type SalesExportFormat, type SalesQuery } from '@/api';
import { colors, radius, space } from './theme';
import { toast } from './Toast';
import type { IconName } from './ui';

type Query = Omit<SalesQuery, 'groupBy' | 'limit'>;

const FORMATS: { format: SalesExportFormat; icon: IconName; title: string; detail: string }[] = [
  {
    format: 'pdf',
    icon: 'document-text-outline',
    title: 'PDF report',
    detail: 'Summary, chart, splits and every transaction — ready to print or share.',
  },
  {
    format: 'xlsx',
    icon: 'grid-outline',
    title: 'Excel sheet',
    detail: 'The same figures in sheets you can sort, filter and total.',
  },
];

/**
 * "Download" pill that offers the sales report for `query` as PDF or Excel. The server makes a
 * short-lived link and the file opens in the browser (web) or the phone's browser / downloads.
 */
export function DownloadReport({ query, description }: { query: Query; description: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<SalesExportFormat | null>(null);
  const insets = useSafeAreaInsets();

  const download = async (format: SalesExportFormat) => {
    setBusy(format);
    try {
      const link = await reportsApi.exportLink({ ...query, format });
      const url = `${API_BASE_URL}${link.path}`;
      // Web: a pop-up opened after the request would be blocked, so load the file in this tab
      // instead — it's sent as an attachment, so the browser downloads it and stays on the page.
      if (Platform.OS === 'web') window.location.assign(url);
      else await Linking.openURL(url);
      setOpen(false);
      toast.success(link.filename, { title: format === 'pdf' ? 'Downloading PDF' : 'Downloading Excel sheet' });
    } catch (e) {
      toast.error(errorMessage(e), { title: 'Could not download the report' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={({ pressed }) => [s.pill, pressed && { opacity: 0.7 }]}>
        <Ionicons name="download-outline" size={16} color={colors.primary} />
        <Text style={s.pillText}>Download</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close" />
        <View style={[s.sheet, { paddingBottom: space.lg + insets.bottom }]}>
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Download sales report</Text>
              <Text style={s.sub} numberOfLines={2}>
                {description}
              </Text>
            </View>
            <Ionicons name="close" size={24} color={colors.muted} onPress={() => setOpen(false)} accessibilityLabel="Close" />
          </View>
          {FORMATS.map((f) => (
            <Pressable
              key={f.format}
              accessibilityRole="button"
              disabled={!!busy}
              onPress={() => download(f.format)}
              style={({ pressed }) => [s.option, pressed && { backgroundColor: colors.primarySoft }]}>
              <View style={s.optionIcon}>
                <Ionicons name={f.icon} size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.optionTitle}>{f.title}</Text>
                <Text style={s.sub}>{f.detail}</Text>
              </View>
              {busy === f.format ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Ionicons name="download-outline" size={20} color={colors.muted} />
              )}
            </Pressable>
          ))}
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pillText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,27,45,0.45)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    gap: space.sm,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, marginBottom: space.sm },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
});
