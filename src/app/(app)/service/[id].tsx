import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { errorMessage, servicesApi, type Service, type ServiceInput, type VehicleCategory } from '@/api';
import { useAuth } from '@/auth/AuthContext';
import { colors, space } from '@/components/theme';
import { toast } from '@/components/Toast';
import { Badge, Button, Card, Chip, EmptyState, Loading, Row, SectionTitle, TextField } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { useVehicleCategories } from '@/hooks/useVehicleCategories';
import { confirm } from '@/lib/confirm';
import { formatDuration, formatMoney } from '@/lib/format';
import { hasOwnRate, isDefaultCategory, rateFor } from '@/lib/pricing';
import { amountError, firstError, maxLengthError, minutesError, nameError } from '@/lib/validation';

const DURATIONS = [15, 20, 30, 45, 60, 90, 120];

/** View / edit a service, or create one when id is "new". */
export default function ServiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const data = useQuery(async () => ({ service: isNew ? null : await servicesApi.get(id) }), [id]);
  const types = useVehicleCategories();

  if (data.loading || types.loading) return <Loading />;
  if (!data.data || (!isNew && !data.data.service)) {
    return (
      <EmptyState
        icon="water-outline"
        title={data.error ? 'Couldn’t load this service' : 'Service not found'}
        action={data.error ? <Button title="Try again" onPress={data.refresh} /> : undefined}
      />
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: isNew ? 'New service' : data.data.service!.name }} />
      <ServiceEditor
        key={id}
        service={data.data.service}
        categories={types.categories}
        onSaved={(s) => data.setData({ service: s })}
      />
    </>
  );
}

function ServiceEditor({
  service,
  categories,
  onSaved,
}: {
  service: Service | null;
  categories: VehicleCategory[];
  onSaved: (s: Service) => void;
}) {
  const { can, config } = useAuth();
  const currency = config?.currency;
  const isNew = service === null;
  const canEdit = isNew ? can('SERVICES_CREATE') : can('SERVICES_UPDATE');

  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [price, setPrice] = useState(service ? String(Number(service.price)) : '');
  // The base price is the default type's (Private) rate; other types may have their own.
  const baseCategory = categories.find(isDefaultCategory);
  const otherCategories = categories.filter((c) => !isDefaultCategory(c));
  const [rates, setRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      otherCategories
        .filter((c) => service && hasOwnRate(service, c.id))
        .map((c) => [c.id, String(Number(rateFor(service!, c.id)))]),
    ),
  );
  const [duration, setDuration] = useState(service ? String(service.durationMinutes) : '30');
  const [busy, setBusy] = useState<'save' | 'status' | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const errors = {
    name: nameError(name, 'service name'),
    description: maxLengthError(description, 1000, 'description'),
    price: amountError(price, 'private vehicle rate'),
    rates:
      otherCategories
        .map((c) => (rates[c.id]?.trim() ? amountError(rates[c.id], `${c.name.toLowerCase()} rate`) : null))
        .find(Boolean) ?? null,
    duration: minutesError(duration),
  };
  const shown = (key: keyof typeof errors) => (showErrors ? errors[key] : null);

  const run = async (key: 'save' | 'status', fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    run('save', async () => {
      const p = Number(price);
      const d = Number(duration);
      setShowErrors(true);
      const problem = firstError(errors);
      if (problem) throw new Error(problem);

      const body: ServiceInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        price: p,
        durationMinutes: d,
        rates: [
          ...otherCategories
            .filter((c) => rates[c.id]?.trim() && Number(rates[c.id]) !== p)
            .map((c) => ({ categoryId: c.id, price: Number(rates[c.id]) })),
          // Keep rates for types that are currently switched off in the admin portal.
          ...(service?.rates ?? [])
            .filter((r) => !categories.some((c) => c.id === r.categoryId))
            .map((r) => ({ categoryId: r.categoryId, price: Number(r.price) })),
        ],
      };
      if (isNew) {
        const created = await servicesApi.create(body);
        router.replace({ pathname: '/service/[id]', params: { id: created.id } });
      } else {
        const updated = await servicesApi.update(service.id, body);
        onSaved({ ...service, ...updated });
        toast.success('Changes saved.');
      }
    });

  // Deactivate/reactivate via PATCH status (reversible). DELETE removes the service for good.
  const toggleActive = () =>
    run('status', async () => {
      if (!service) return;
      const next = service.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      if (
        next === 'INACTIVE' &&
        !(await confirm('Deactivate service?', 'It will no longer be offered on New wash. You can reactivate it later.', 'Deactivate', true))
      ) {
        return;
      }
      const updated = await servicesApi.update(service.id, { status: next });
      onSaved({ ...service, ...updated, status: next });
    });

  const remove = () =>
    run('status', async () => {
      if (!service) return;
      if (!(await confirm('Delete service?', 'It will be removed permanently and can’t be reactivated. Past bookings keep their records.', 'Delete', true))) {
        return;
      }
      await servicesApi.remove(service.id);
      router.back();
    });

  // ---- read-only view (e.g. staff) ----
  if (!canEdit && service) {
    return (
      <ScrollView contentContainerStyle={{ padding: space.lg }}>
        <Card style={{ marginBottom: space.lg }}>
          <View style={s.headerRow}>
            <Text style={s.title}>{service.name}</Text>
            {service.status !== 'ACTIVE' && <Badge label="Inactive" color={colors.muted} bg="#E6EAEE" />}
          </View>
          {!!service.description && <Text style={s.desc}>{service.description}</Text>}
          {categories.length ? (
            categories.map((c) => (
              <Row key={c.id} icon="car-outline" label={c.name} value={formatMoney(rateFor(service, c.id), currency)} />
            ))
          ) : (
            <Row icon="car-outline" label="Rate" value={formatMoney(service.price, currency)} />
          )}
          <Row icon="time-outline" label="Duration" value={formatDuration(service.durationMinutes)} />
        </Card>
        {service.status === 'ACTIVE' && can('BOOKINGS_CREATE') && can('ORDERS_CREATE') && (
          <Button
            title="Start a wash with this service"
            icon="water"
            onPress={() => router.push({ pathname: '/wash/new', params: { serviceId: service.id } })}
          />
        )}
      </ScrollView>
    );
  }

  // ---- edit / create ----
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        {service?.status === 'INACTIVE' && (
          <View style={s.inactive}>
            <Ionicons name="pause-circle-outline" size={18} color={colors.muted} />
            <Text style={{ color: colors.muted, flex: 1 }}>This service is inactive and isn’t offered on New wash.</Text>
          </View>
        )}

        <SectionTitle>Details</SectionTitle>
        <TextField
          label="Service name *"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Premium Wash"
          maxLength={150}
          error={shown('name')}
        />
        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="What's included"
          maxLength={1000}
          error={shown('description')}
          multiline
        />

        <SectionTitle>Rates ({currency ?? 'INR'})</SectionTitle>
        <Card style={{ marginBottom: space.lg }}>
          <TextField
            label={`${baseCategory?.name ?? 'Private'} rate *`}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="e.g. 399"
            maxLength={10}
            error={shown('price')}
            hint={otherCategories.length ? 'Also charged for any vehicle type below left empty.' : undefined}
          />
          {otherCategories.map((c) => (
            <TextField
              key={c.id}
              label={`${c.name} rate`}
              value={rates[c.id] ?? ''}
              onChangeText={(t) => setRates((r) => ({ ...r, [c.id]: t }))}
              keyboardType="decimal-pad"
              placeholder={`Same as ${baseCategory?.name ?? 'private'}${price.trim() ? ` (${formatMoney(price, currency)})` : ''}`}
              maxLength={10}
              error={
                showErrors && rates[c.id]?.trim() ? amountError(rates[c.id], `${c.name.toLowerCase()} rate`) : null
              }
            />
          ))}
        </Card>

        <SectionTitle>Duration</SectionTitle>
        <View style={[s.wrap, { marginBottom: space.md }]}>
          {DURATIONS.map((m) => (
            <Chip key={m} label={formatDuration(m)} selected={duration === String(m)} onPress={() => setDuration(String(m))} />
          ))}
        </View>
        <TextField
          label="Minutes"
          value={duration}
          onChangeText={(t) => setDuration(t.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={4}
          error={shown('duration')}
        />

        <Button
          title={isNew ? 'Create service' : 'Save changes'}
          icon="checkmark"
          onPress={save}
          loading={busy === 'save'}
          disabled={busy !== null}
          style={{ marginTop: space.md }}
        />

        {service && can('SERVICES_UPDATE') && (
          <Button
            title={service.status === 'ACTIVE' ? 'Deactivate service' : 'Reactivate service'}
            variant="secondary"
            icon={service.status === 'ACTIVE' ? 'pause-circle-outline' : 'play-circle-outline'}
            onPress={toggleActive}
            loading={busy === 'status'}
            disabled={busy !== null}
            style={{ marginTop: space.md }}
          />
        )}
        {service && can('SERVICES_DELETE') && (
          <Button
            title="Delete service"
            variant="danger"
            icon="trash-outline"
            onPress={remove}
            disabled={busy !== null}
            style={{ marginTop: space.md }}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, flex: 1 },
  desc: { color: colors.muted, fontSize: 14, marginTop: 4, marginBottom: space.sm },
  hint: { fontSize: 12, color: colors.muted, marginTop: 2 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  inactive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: '#EEF1F5',
    padding: space.md,
    borderRadius: 10,
    marginBottom: space.md,
  },
});
