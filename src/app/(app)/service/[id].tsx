import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { errorMessage, servicesApi, type Service, type ServiceInput } from '@/api';
import { useAuth } from '@/auth/AuthContext';
import { colors, space } from '@/components/theme';
import { toast } from '@/components/Toast';
import { Badge, Button, Card, Chip, EmptyState, Loading, Row, SectionTitle, TextField } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { confirm } from '@/lib/confirm';
import { formatDuration, formatMoney } from '@/lib/format';
import { hasDifferentTaxiRate, rateFor, supportsTaxiRates } from '@/lib/pricing';

const DURATIONS = [15, 20, 30, 45, 60, 90, 120];

/** View / edit a service, or create one when id is "new". */
export default function ServiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const data = useQuery(async () => {
    if (!isNew) {
      const service = await servicesApi.get(id);
      return { service, taxiSupported: supportsTaxiRates([service]) };
    }
    // New service: look at any existing service to see whether the server has taxi rates yet.
    const sample = await servicesApi.list({ limit: 1 });
    return { service: null, taxiSupported: supportsTaxiRates(sample.items) };
  }, [id]);

  if (data.loading) return <Loading />;
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
        taxiSupported={data.data.taxiSupported}
        onSaved={(s) => data.setData({ service: s, taxiSupported: data.data!.taxiSupported })}
      />
    </>
  );
}

function ServiceEditor({
  service,
  taxiSupported,
  onSaved,
}: {
  service: Service | null;
  taxiSupported: boolean;
  onSaved: (s: Service) => void;
}) {
  const { can, config } = useAuth();
  const currency = config?.currency;
  const isNew = service === null;
  const canEdit = isNew ? can('SERVICES_CREATE') : can('SERVICES_UPDATE');

  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [price, setPrice] = useState(service ? String(Number(service.price)) : '');
  const [sameTaxiRate, setSameTaxiRate] = useState(!service || !hasDifferentTaxiRate(service));
  const [taxiPrice, setTaxiPrice] = useState(
    service && hasDifferentTaxiRate(service) ? String(Number(rateFor(service, 'TAXI'))) : '',
  );
  const [duration, setDuration] = useState(service ? String(service.durationMinutes) : '30');
  const [busy, setBusy] = useState<'save' | 'status' | null>(null);

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
      const t = Number(taxiPrice);
      const d = Number(duration);
      if (!name.trim()) throw new Error('Enter a service name.');
      if (!price.trim() || !Number.isFinite(p) || p < 0) throw new Error('Enter a valid private vehicle rate.');
      if (taxiSupported && !sameTaxiRate && (!taxiPrice.trim() || !Number.isFinite(t) || t < 0)) {
        throw new Error('Enter a valid taxi rate, or switch on “Same rate for taxis”.');
      }
      if (!Number.isInteger(d) || d <= 0) throw new Error('Enter the duration in whole minutes.');

      const body: ServiceInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        price: p,
        durationMinutes: d,
        // Only sent once the server supports it, so today's API doesn't reject the request.
        ...(taxiSupported ? { taxiPrice: sameTaxiRate ? null : t } : {}),
      };
      if (isNew) {
        const created = await servicesApi.create(body);
        router.replace({ pathname: '/service/[id]', params: { id: created.id } });
      } else {
        const updated = await servicesApi.update(service.id, body);
        onSaved({ ...service, ...body, ...updated });
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
          <Row icon="car-outline" label="Private" value={formatMoney(service.price, currency)} />
          <Row icon="car-sport-outline" label="Taxi" value={formatMoney(rateFor(service, 'TAXI'), currency)} />
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
        <TextField label="Service name *" value={name} onChangeText={setName} placeholder="e.g. Premium Wash" />
        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="What's included"
          multiline
        />

        <SectionTitle>Rates ({currency ?? 'INR'})</SectionTitle>
        <Card style={{ marginBottom: space.lg }}>
          <TextField
            label="Private vehicle rate *"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="e.g. 399"
          />
          <View style={s.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.switchLabel}>Same rate for taxis</Text>
              <Text style={s.hint}>
                {taxiSupported
                  ? 'Turn off to charge taxis a different rate.'
                  : 'Taxi rates need a server update. Until then taxis are charged the private rate.'}
              </Text>
            </View>
            <Switch
              value={taxiSupported ? sameTaxiRate : true}
              onValueChange={setSameTaxiRate}
              disabled={!taxiSupported}
              trackColor={{ true: colors.primary }}
            />
          </View>
          {taxiSupported && !sameTaxiRate && (
            <View style={{ marginTop: space.lg }}>
              <TextField
                label="Taxi rate *"
                value={taxiPrice}
                onChangeText={setTaxiPrice}
                keyboardType="decimal-pad"
                placeholder="e.g. 349"
              />
            </View>
          )}
        </Card>

        <SectionTitle>Duration</SectionTitle>
        <View style={[s.wrap, { marginBottom: space.md }]}>
          {DURATIONS.map((m) => (
            <Chip key={m} label={formatDuration(m)} selected={duration === String(m)} onPress={() => setDuration(String(m))} />
          ))}
        </View>
        <TextField label="Minutes" value={duration} onChangeText={setDuration} keyboardType="number-pad" />

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
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  switchLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
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
