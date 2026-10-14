import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import {
  errorMessage,
  promotionsApi,
  reportsApi,
  servicesApi,
  vehicleCategoriesApi,
  VEHICLE_TYPES,
  type AudienceCustomer,
  type PromotionChannel,
  type VehicleType,
} from '@/api';
import { useAuth } from '@/auth/AuthContext';
import { PeriodPicker, usePeriod } from '@/components/PeriodPicker';
import { colors, radius, space } from '@/components/theme';
import { toast } from '@/components/Toast';
import { Badge, Button, Card, Chip, EmptyState, Loading, SearchBar, Segmented, TextField } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { formatDay, formatMoney, formatPhone, toDateString } from '@/lib/format';
import {
  CHANNELS,
  DISCOUNTS,
  formatWhen,
  isValidTime,
  offerTemplate,
  previewMessage,
  scheduleDate,
  scheduleShortcuts,
} from '@/lib/promotions';
import { bodyLabel, formatRange, isValidDate, PERIODS } from '@/lib/report';

type Paid = 'PAID' | 'UNPAID' | null;
type When = 'now' | 'later';

const BODIES: VehicleType[] = ['MOTORCYCLE', ...VEHICLE_TYPES.filter((t) => t !== 'MOTORCYCLE')];
const VISITS: readonly (readonly [number, string])[] = [
  [1, 'Any'],
  [2, '2+ washes'],
  [3, '3+ washes'],
  [5, '5+ washes'],
];
/** The service the group starts from, if the car wash has one by this name. */
const DEFAULT_SERVICE = 'basic wash';

/**
 * Create a promotion in two steps: pick the customers (last 7 days' Basic Wash customers to start
 * with, narrowed or widened with the filters), then write the message and send it now or schedule it.
 */
export default function NewPromotionScreen() {
  const { config, user } = useAuth();
  const money = (n: number) => formatMoney(n, config?.currency);
  const [step, setStep] = useState<1 | 2>(1);

  // ---- step 1: the group ----
  const period = usePeriod({ period: 'week' });
  const { range } = period;
  /** undefined until the owner picks one: then the Basic Wash default applies. */
  const [serviceChoice, setServiceChoice] = useState<string | null | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [paid, setPaid] = useState<Paid>(null);
  const [minVisits, setMinVisits] = useState(1);
  const [notReturned, setNotReturned] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [search, setSearch] = useState('');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const options = useQuery(
    async () => {
      const [services, categories] = await Promise.all([
        servicesApi.list({ limit: 100, status: 'ACTIVE' }),
        vehicleCategoriesApi.list(),
      ]);
      return { services: services.items, categories };
    },
    [],
    { staleMs: 5 * 60_000 },
  );
  const services = options.data?.services ?? [];
  const categories = options.data?.categories ?? [];
  const defaultServiceId = services.find((sv) => sv.name.trim().toLowerCase() === DEFAULT_SERVICE)?.id ?? null;
  const serviceId = serviceChoice === undefined ? defaultServiceId : serviceChoice;
  const serviceName = services.find((sv) => sv.id === serviceId)?.name ?? null;
  const categoryName = categories.find((c) => c.id === categoryId)?.name ?? null;

  const ready = !!options.data && !period.customError;
  const audience = useQuery(
    async () =>
      ready
        ? reportsApi.customers({ ...range, serviceId, categoryId, vehicleType, paymentStatus: paid, minVisits, notReturned })
        : null,
    [ready, range.from, range.to, serviceId, categoryId, vehicleType, paid, minVisits, notReturned],
  );
  const everyone = useMemo(() => audience.data?.customers ?? [], [audience.data]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/\s+/g, '');
    if (!q) return everyone;
    return everyone.filter((c) =>
      [c.name, c.phone ?? '', ...c.vehicles.map((v) => v.registrationNumber)].some((t) => t.toLowerCase().replace(/\s+/g, '').includes(q)),
    );
  }, [everyone, search]);
  const chosen = everyone.filter((c) => !excluded.has(c.id));
  const reachable = chosen.filter((c) => c.phone);
  const allVisibleChosen = visible.length > 0 && visible.every((c) => !excluded.has(c.id));

  const toggle = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setExcluded((prev) => {
      const next = new Set(prev);
      for (const c of visible) {
        if (allVisibleChosen) next.add(c.id);
        else next.delete(c.id);
      }
      return next;
    });

  const periodLabel = period.period === 'custom' ? formatRange(range) : (PERIODS.find(([k]) => k === period.period)?.[1] ?? formatRange(range));
  const audienceLabel = [
    serviceName,
    categoryName,
    vehicleType && bodyLabel(vehicleType),
    paid === 'PAID' ? 'Paid' : paid === 'UNPAID' ? 'Not paid' : null,
    minVisits > 1 && `${minVisits}+ washes`,
    notReturned && 'Not back since',
    period.period === 'weeks' ? `Last ${period.weeks} weeks` : periodLabel,
  ]
    .filter(Boolean)
    .join(' · ');

  // ---- step 2: the message ----
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState<PromotionChannel>('WHATSAPP');
  const [discount, setDiscount] = useState(10);
  const [customMessage, setCustomMessage] = useState<string | null>(null);
  const [when, setWhen] = useState<When>('now');
  const [day, setDay] = useState(() => scheduleShortcuts()[1].day);
  const [time, setTime] = useState('09:00');
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  /** When the form opened; the server re-checks the time when it's saved. */
  const [openedAt] = useState(() => Date.now());

  const message = customMessage ?? offerTemplate(discount, serviceName, user?.carWash?.name);
  const sendAt = when === 'later' ? scheduleDate(day, time) : null;
  const errors = {
    title: title.trim() ? null : 'Give the promotion a title',
    message: message.trim() ? null : 'Write the message',
    day: when === 'later' && !isValidDate(day) ? 'Use YYYY-MM-DD' : null,
    time:
      when === 'later' && !isValidTime(time)
        ? 'Use 24-hour HH:MM, e.g. 18:30'
        : when === 'later' && sendAt && sendAt.getTime() < openedAt
          ? 'Pick a time in the future'
          : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const goNext = () => {
    if (!title) setTitle(serviceName ? `${serviceName} offer` : 'Special offer');
    setStep(2);
  };

  const save = async () => {
    setShowErrors(true);
    if (hasErrors || saving) return;
    setSaving(true);
    try {
      const created = await promotionsApi.create({
        title: title.trim(),
        message: message.trim(),
        channel,
        customerIds: chosen.map((c) => c.id),
        sendAt: sendAt ? sendAt.toISOString() : null,
        audienceLabel,
        audience: { ...range, serviceId, categoryId, vehicleType, paymentStatus: paid, minVisits, notReturned, removedByHand: excluded.size },
      });
      toast.success(
        sendAt
          ? `It goes to ${created.recipientCount - created.skippedCount} customers ${formatWhen(sendAt)}.`
          : `Sending to ${created.recipientCount - created.skippedCount} customers now.`,
        { title: sendAt ? 'Promotion scheduled' : 'Promotion created' },
      );
      router.back();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (!options.data) return <Loading />;

  if (step === 2) {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.list} keyboardShouldPersistTaps="handled">
          <StepHeader step={2} title="Message" />
          <Pressable onPress={() => setStep(1)} style={s.groupSummary} accessibilityRole="button" accessibilityHint="Back to choosing customers">
            <Ionicons name="people" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={s.groupTitle}>
                {chosen.length} customer{chosen.length === 1 ? '' : 's'}
                {reachable.length < chosen.length ? ` · ${chosen.length - reachable.length} without a phone will be skipped` : ''}
              </Text>
              <Text style={s.sub} numberOfLines={1}>
                {audienceLabel}
              </Text>
            </View>
            <Text style={s.link}>Change</Text>
          </Pressable>

          <TextField
            label="Promotion title"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Diwali offer"
            maxLength={150}
            error={showErrors ? errors.title : null}
            hint="Only you see this, in the promotions list."
          />

          <Text style={s.label}>Send by</Text>
          <Segmented options={CHANNELS} value={channel} onChange={setChannel} />

          <Text style={[s.label, { marginTop: space.md }]}>Quick offer</Text>
          <View style={s.wrapChips}>
            {DISCOUNTS.map((d) => (
              <Chip
                key={d}
                label={`${d}% off`}
                selected={customMessage === null && discount === d}
                onPress={() => {
                  setDiscount(d);
                  setCustomMessage(null);
                }}
              />
            ))}
          </View>

          <View style={s.labelRow}>
            <Text style={s.label}>Message</Text>
            {customMessage !== null && (
              <Text style={s.link} onPress={() => setCustomMessage(null)}>
                Use the quick offer
              </Text>
            )}
          </View>
          <TextInput value={message} onChangeText={setCustomMessage} multiline maxLength={1000} style={s.message} placeholder="Write your message" placeholderTextColor="#98A2B3" />
          <Text style={showErrors && errors.message ? s.error : s.hint}>
            {showErrors && errors.message ? errors.message : `{name} becomes each customer’s first name · ${message.length}/1000`}
          </Text>

          <Text style={[s.label, { marginTop: space.md }]}>Preview</Text>
          <View style={[s.bubble, channel === 'SMS' && { backgroundColor: '#E9EEF6' }]}>
            <Text style={s.bubbleText}>{previewMessage(message, chosen[0]?.name)}</Text>
          </View>

          <Text style={[s.label, { marginTop: space.lg }]}>When</Text>
          <Segmented
            options={[
              ['now', 'Send now'],
              ['later', 'Schedule'],
            ]}
            value={when}
            onChange={setWhen}
          />
          {when === 'later' && (
            <View style={{ marginTop: space.md }}>
              <View style={s.wrapChips}>
                {scheduleShortcuts().map((sc) => (
                  <Chip
                    key={sc.label}
                    label={sc.label}
                    selected={day === sc.day && time === sc.time}
                    onPress={() => {
                      setDay(sc.day);
                      setTime(sc.time);
                    }}
                  />
                ))}
              </View>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <TextField
                    label="Date"
                    value={day}
                    onChangeText={setDay}
                    placeholder={toDateString(new Date())}
                    maxLength={10}
                    keyboardType="numbers-and-punctuation"
                    error={showErrors || !isValidDate(day) ? errors.day : null}
                    hint={isValidDate(day) ? formatDay(day) : undefined}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField
                    label="Time (24h)"
                    value={time}
                    onChangeText={setTime}
                    placeholder="09:00"
                    maxLength={5}
                    keyboardType="numbers-and-punctuation"
                    error={showErrors || (time.length >= 4 && !isValidTime(time)) ? errors.time : null}
                  />
                </View>
              </View>
              {sendAt && !errors.time && <Text style={s.whenNote}>Goes out {formatWhen(sendAt)}</Text>}
            </View>
          )}
        </ScrollView>

        <View style={s.bottomBar}>
          <Button title="Back" variant="secondary" icon="chevron-back" onPress={() => setStep(1)} />
          <Button
            title={when === 'now' ? `Send to ${reachable.length}` : 'Save & schedule'}
            icon={when === 'now' ? 'paper-plane-outline' : 'time-outline'}
            onPress={save}
            loading={saving}
            disabled={!reachable.length}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    );
  }

  const header = (
    <View>
      <StepHeader step={1} title="Choose customers" />
      <PeriodPicker state={period} />

      <Pressable accessibilityRole="button" onPress={() => setShowFilters((v) => !v)} style={s.filterToggle}>
        <Ionicons name="options-outline" size={18} color={colors.primary} />
        <Text style={s.filterToggleText}>Filters</Text>
        <Ionicons name={showFilters ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
        {!showFilters && (
          <Text style={s.filterSummary} numberOfLines={1}>
            {audienceLabel}
          </Text>
        )}
      </Pressable>

      {showFilters && (
        <Card style={s.filters}>
          <FilterRow label="Service">
            <Chip label="All" selected={!serviceId} onPress={() => setServiceChoice(null)} />
            {services.map((sv) => (
              <Chip key={sv.id} label={sv.name} selected={serviceId === sv.id} onPress={() => setServiceChoice(serviceId === sv.id ? null : sv.id)} />
            ))}
          </FilterRow>
          <FilterRow label="Vehicle type">
            <Chip label="All" selected={!categoryId} onPress={() => setCategoryId(null)} />
            {categories.map((c) => (
              <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(categoryId === c.id ? null : c.id)} />
            ))}
          </FilterRow>
          <FilterRow label="Body">
            <Chip label="All" selected={!vehicleType} onPress={() => setVehicleType(null)} />
            {BODIES.map((b) => (
              <Chip key={b} label={bodyLabel(b)} selected={vehicleType === b} onPress={() => setVehicleType(vehicleType === b ? null : b)} />
            ))}
          </FilterRow>
          <FilterRow label="Payment">
            <Chip label="All" selected={!paid} onPress={() => setPaid(null)} />
            <Chip label="Paid" selected={paid === 'PAID'} onPress={() => setPaid(paid === 'PAID' ? null : 'PAID')} />
            <Chip label="Not paid" selected={paid === 'UNPAID'} onPress={() => setPaid(paid === 'UNPAID' ? null : 'UNPAID')} />
          </FilterRow>
          <FilterRow label="Washes in this period">
            {VISITS.map(([n, label]) => (
              <Chip key={n} label={label} selected={minVisits === n} onPress={() => setMinVisits(n)} />
            ))}
          </FilterRow>
          <View style={s.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.switchLabel}>Only customers who haven’t come back</Text>
              <Text style={s.sub}>
                {range.to >= toDateString(new Date())
                  ? 'Works for a period that has ended, e.g. last month.'
                  : `Leave out anyone with a wash after ${formatDay(range.to)}.`}
              </Text>
            </View>
            <Switch value={notReturned} onValueChange={setNotReturned} trackColor={{ true: colors.primary, false: colors.border }} />
          </View>
        </Card>
      )}

      <SearchBar value={search} onChangeText={setSearch} placeholder="Name, phone or vehicle number" />
      <View style={s.listHead}>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: allVisibleChosen }} onPress={toggleAll} disabled={!visible.length} style={s.selectAll}>
          <Ionicons name={allVisibleChosen ? 'checkbox' : 'square-outline'} size={22} color={colors.primary} />
          <Text style={s.selectAllText}>{allVisibleChosen ? 'Unselect all' : 'Select all'}</Text>
        </Pressable>
        <Text style={s.sub}>
          {everyone.length} found{audience.data?.truncated ? ' (first 2,000)' : ''}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={visible}
        keyExtractor={(c) => c.id}
        contentContainerStyle={s.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ListEmptyComponent={
          audience.loading || !ready ? (
            <Loading />
          ) : (
            <EmptyState icon="people-outline" title="No customers" message="Nobody matches this period and these filters. Try a longer period or fewer filters." />
          )
        }
        renderItem={({ item }) => <CustomerRow c={item} checked={!excluded.has(item.id)} onToggle={() => toggle(item.id)} money={money} />}
      />
      <View style={s.bottomBar}>
        <View style={{ flex: 1 }}>
          <Text style={s.countText}>
            {chosen.length} selected
          </Text>
          {chosen.length > reachable.length && <Text style={s.sub}>{chosen.length - reachable.length} without a phone</Text>}
        </View>
        <Button title="Next" icon="chevron-forward" onPress={goNext} disabled={!reachable.length} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

function CustomerRow({ c, checked, onToggle, money }: { c: AudienceCustomer; checked: boolean; onToggle: () => void; money: (n: number) => string }) {
  return (
    <Card style={[s.item, checked && s.itemChecked, !c.phone && { opacity: 0.6 }]} onPress={onToggle}>
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? colors.primary : colors.muted} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={s.titleRow}>
          <Text style={s.name} numberOfLines={1}>
            {c.name}
          </Text>
          {!c.phone && <Badge label="No phone" color={colors.danger} bg={colors.dangerSoft} />}
          {c.returned && <Badge label="Came back" color={colors.success} bg={colors.successSoft} />}
        </View>
        <Text style={s.sub} numberOfLines={1}>
          {[formatPhone(c.phone), c.vehicles.map((v) => v.registrationNumber).join(', ')].filter(Boolean).join(' · ')}
        </Text>
        <Text style={s.sub} numberOfLines={1}>
          {c.visits} wash{c.visits === 1 ? '' : 'es'} · last {formatDay(c.lastVisit)}
          {c.services.length ? ` · ${c.services.join(', ')}` : ''}
        </Text>
      </View>
      <Text style={s.amount}>{money(c.spent)}</Text>
    </Card>
  );
}

function StepHeader({ step, title }: { step: 1 | 2; title: string }) {
  return (
    <View style={s.stepHeader}>
      <View style={s.steps}>
        {[1, 2].map((n) => (
          <View key={n} style={[s.stepDot, n <= step && s.stepDotOn]} />
        ))}
      </View>
      <Text style={s.stepText}>
        Step {step} of 2 · <Text style={{ color: colors.text }}>{title}</Text>
      </Text>
    </View>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View>
      <Text style={s.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {children}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  list: { padding: space.lg, paddingBottom: 32 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  steps: { flexDirection: 'row', gap: 4 },
  stepDot: { width: 18, height: 4, borderRadius: 2, backgroundColor: colors.border },
  stepDotOn: { backgroundColor: colors.primary },
  stepText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  filterToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: space.md },
  filterToggleText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  filterSummary: { flex: 1, color: colors.muted, fontSize: 13, marginLeft: space.xs },
  filters: { marginBottom: space.md, paddingBottom: space.sm },
  filterLabel: { fontSize: 12, fontWeight: '700', color: colors.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  chips: { gap: space.sm, paddingBottom: space.md },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
  switchLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 2 },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.md, marginBottom: space.sm },
  selectAll: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: space.xs },
  selectAllText: { fontSize: 14, fontWeight: '600', color: colors.text },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm, paddingVertical: space.md },
  itemChecked: { borderColor: colors.primary, backgroundColor: '#F5F9FF' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  name: { fontSize: 16, fontWeight: '700', color: colors.text, flexShrink: 1 },
  sub: { fontSize: 13, color: colors.muted },
  amount: { fontSize: 15, fontWeight: '800', color: colors.text },
  countText: { fontSize: 15, fontWeight: '800', color: colors.text },
  groupSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.lg,
  },
  groupTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  row: { flexDirection: 'row', gap: space.sm },
  message: {
    minHeight: 110,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: 15,
    color: colors.text,
    textAlignVertical: 'top',
  },
  hint: { fontSize: 12, color: colors.muted, marginTop: 4 },
  error: { fontSize: 12, color: colors.danger, marginTop: 4 },
  bubble: { alignSelf: 'flex-start', maxWidth: '90%', backgroundColor: '#DCF8C6', borderRadius: radius.md, padding: space.md },
  bubbleText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  whenNote: { fontSize: 13, color: colors.primaryDark, fontWeight: '700' },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
