import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import {
  bookingsApi,
  customersApi,
  errorMessage,
  ordersApi,
  servicesApi,
  vehiclesApi,
  type Customer,
  type Vehicle,
  type VehicleCategory,
} from '@/api';
import { useAuth } from '@/auth/AuthContext';
import { colors, radius, space } from '@/components/theme';
import { Button, Card, Chip, ErrorBanner, Loading, SectionTitle, Segmented, TextField } from '@/components/ui';
import { BrandModelFields } from '@/components/BrandModelFields';
import { toast } from '@/components/Toast';
import { VehicleNumberInput } from '@/components/VehicleNumberInput';
import { useDebounced, useQuery } from '@/hooks/useQuery';
import { formatDuration, formatMoney, toDateString, toTimeString } from '@/lib/format';
import { emptyPlate, isPlateComplete, plateString } from '@/lib/plates';
import { vehicleTypeFor, vehicleTypeLabel } from '@/lib/vehicleCatalog';
import { rateFor, supportsTaxiRates, TAXI_NOTE } from '@/lib/pricing';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const last10 = (s: string) => s.replace(/\D/g, '').slice(-10);
const normReg = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

type Lookup = { key: string; customer: Customer | null; cars: Vehicle[] };

/**
 * One-screen New wash, starting from the customer's mobile number:
 *  - known customer → name filled in, their cars listed (one car is picked automatically)
 *  - new customer / new car → fill the fields inline
 * "Start wash" then creates whatever is new (customer → car) plus the booking and job.
 */
export default function NewWashScreen() {
  const params = useLocalSearchParams<{ vehicleId?: string; serviceId?: string }>();
  const { config, can } = useAuth();

  // --- 1. customer (by mobile) ---
  const [phone, setPhone] = useState('');
  const phoneKey = useDebounced(last10(phone), 400);
  const phoneReady = phoneKey.length === 10;

  const lookup = useQuery<Lookup | null>(async () => {
    if (!phoneReady) return null;
    const found = await customersApi.list({ search: phoneKey, limit: 10 });
    const customer = found.items.find((c) => last10(c.phone) === phoneKey) ?? null;
    const cars = customer ? (await vehiclesApi.list({ customerId: customer.id, limit: 50 })).items : [];
    return { key: phoneKey, customer, cars };
  }, [phoneKey]);

  const settled = phoneReady && last10(phone) === phoneKey && lookup.data?.key === phoneKey;
  const customer = settled ? lookup.data!.customer : null;
  const cars = settled ? lookup.data!.cars : [];
  const [name, setName] = useState('');

  // --- 2. car: pick one of theirs, or add a new one ---
  const [carChoice, setCarChoice] = useState<string | 'new' | null>(null);
  const chosenCar =
    carChoice && carChoice !== 'new' ? cars.find((c) => c.id === carChoice) : cars.length === 1 && carChoice !== 'new' ? cars[0] : undefined;
  const addingCar = settled && !chosenCar && (carChoice === 'new' || cars.length === 0);

  const [plate, setPlate] = useState(emptyPlate);
  const reg = plateString(plate);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');

  // Coming from the Cars tab: prefill the owner's mobile and that car.
  useEffect(() => {
    if (!params.vehicleId) return;
    vehiclesApi
      .get(params.vehicleId)
      .then((v) => customersApi.get(v.customerId).then((c) => ({ v, c })))
      .then(
        ({ v, c }) => {
          setPhone(c.phone);
          setCarChoice(v.id);
        },
        () => {},
      );
  }, [params.vehicleId]);

  // --- 3. service & time ---
  const [serviceId, setServiceId] = useState<string | undefined>(params.serviceId);
  const services = useQuery(() => servicesApi.list({ status: 'ACTIVE', limit: 100 }).then((r) => r.items));
  const service = services.data?.find((x) => x.id === serviceId);
  const [category, setCategory] = useState<VehicleCategory>('PRIVATE');
  const taxiSupported = supportsTaxiRates(services.data);

  const [schedule, setSchedule] = useState(false);
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const [time, setTime] = useState(() => toTimeString(new Date()));
  const [checkInNow, setCheckInNow] = useState(true);
  const [notes, setNotes] = useState('');
  const willCheckIn = !schedule || (checkInNow && day === 'today');

  // --- submit (remembers what was already saved so a retry never duplicates) ---
  const [saved, setSaved] = useState<{ customer?: Customer; vehicle?: Vehicle; bookingId?: string }>({});
  const [step, setStep] = useState<string | null>(null);

  const canAddNew = can('CUSTOMERS_CREATE') && can('VEHICLES_CREATE');

  const submit = async () => {
    if (!phoneReady) return toast.error('Enter the customer’s 10-digit mobile number.');
    if (!settled) return toast.error('Looking up the customer… try again in a moment.');
    if (!customer && !name.trim()) return toast.error('Enter the customer’s name.');
    if (!chosenCar && !addingCar) return toast.error('Choose which car is here.');
    if (addingCar && !isPlateComplete(plate)) return toast.error('Enter the full vehicle number, e.g. KL 07 AB 1234.');
    if (!serviceId) return toast.error('Choose a service.');
    if (schedule && !TIME_RE.test(time)) return toast.error('Enter the time as HH:MM, e.g. 14:30.');

    const now = new Date();
    const date = new Date(now);
    if (schedule && day === 'tomorrow') date.setDate(date.getDate() + 1);

    let done = saved;
    const remember = (patch: typeof saved) => {
      done = { ...done, ...patch };
      setSaved(done);
    };

    try {
      let owner = customer ?? (done.customer && last10(done.customer.phone) === phoneKey ? done.customer : null);
      if (!owner) {
        setStep('Saving customer…');
        owner = await customersApi.create({ name: name.trim(), phone: phone.trim() });
        remember({ customer: owner });
      }

      let car = chosenCar ?? (done.vehicle && normReg(done.vehicle.registrationNumber) === reg ? done.vehicle : null);
      if (!car) {
        setStep('Adding car…');
        car = await vehiclesApi.create({
          customerId: owner.id,
          registrationNumber: reg,
          brand: brand.trim() || undefined,
          model: model.trim() || undefined,
          vehicleType: vehicleTypeFor(brand, model),
        });
        remember({ vehicle: car });
      }

      let bookingId = done.bookingId;
      if (!bookingId) {
        setStep('Booking…');
        const booking = await bookingsApi.create({
          customerId: owner.id,
          vehicleId: car.id,
          serviceId,
          bookingDate: toDateString(date),
          startTime: schedule ? time : toTimeString(now),
          // Until the server stores the category, taxis are flagged in the notes instead.
          ...(taxiSupported
            ? { vehicleCategory: category, notes: notes.trim() || undefined }
            : { notes: [category === 'TAXI' ? TAXI_NOTE : '', notes.trim()].filter(Boolean).join(' — ') || undefined }),
        });
        bookingId = booking.id;
        remember({ bookingId });
      }

      if (willCheckIn) {
        setStep('Checking in…');
        const order = await ordersApi.checkIn(bookingId);
        router.replace({ pathname: '/order/[id]', params: { id: order.id } });
      } else {
        router.back();
      }
    } catch (e) {
      const kept = [done.customer && 'customer', done.vehicle && 'car', done.bookingId && 'booking'].filter(Boolean);
      toast.error(errorMessage(e) + (kept.length ? `\n(Already saved: ${kept.join(', ')} — tap again to continue.)` : ''));
      setStep(null);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        {/* 1 · Customer */}
        <SectionTitle>Customer</SectionTitle>
        <TextField
          label="Mobile number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="10-digit mobile number"
          maxLength={16}
          autoFocus={!params.vehicleId}
        />
        {phoneReady && !settled && <Text style={s.hint}>Looking up customer…</Text>}

        {settled &&
          (customer ? (
            <Card style={s.customerCard}>
              <Ionicons name="person-circle" size={32} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{customer.name}</Text>
                <Text style={s.sub}>
                  Returning customer · {cars.length} car{cars.length === 1 ? '' : 's'}
                </Text>
              </View>
            </Card>
          ) : canAddNew ? (
            <>
              <View style={s.newBanner}>
                <Ionicons name="sparkles-outline" size={16} color={colors.primaryDark} />
                <Text style={s.newBannerText}>New customer</Text>
              </View>
              <TextField label="Customer name" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Full name" />
            </>
          ) : (
            <ErrorBanner message="No customer with this number, and your role can't add new customers." />
          ))}

        {/* 2 · Car */}
        {settled && (customer || canAddNew) && (
          <View style={{ marginTop: space.lg }}>
            <SectionTitle>Car</SectionTitle>

            {cars.length > 0 && (
              <View style={{ marginBottom: space.sm }}>
                {cars.map((c) => {
                  const selected = chosenCar?.id === c.id;
                  return (
                    <Card key={c.id} onPress={() => setCarChoice(c.id)} style={[s.option, selected && s.selectedBorder]}>
                      <Ionicons
                        name={selected ? 'radio-button-on' : 'radio-button-off'}
                        size={22}
                        color={selected ? colors.primary : colors.muted}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={s.reg}>{c.registrationNumber}</Text>
                        <Text style={s.sub}>
                          {[c.brand, c.model].filter(Boolean).join(' ') || 'Car'}
                          {c.vehicleType ? ` · ${vehicleTypeLabel(c.vehicleType)}` : ''}
                        </Text>
                      </View>
                    </Card>
                  );
                })}
                {can('VEHICLES_CREATE') && (
                  <Card onPress={() => setCarChoice('new')} style={[s.option, addingCar && s.selectedBorder]}>
                    <Ionicons name={addingCar ? 'radio-button-on' : 'add-circle-outline'} size={22} color={colors.primary} />
                    <Text style={[s.name, { color: colors.primary }]}>Another car</Text>
                  </Card>
                )}
              </View>
            )}

            {addingCar && (
              <View>
                <VehicleNumberInput label="Vehicle number" value={plate} onChange={setPlate} />
                <BrandModelFields
                  brand={brand}
                  model={model}
                  onChange={(v) => {
                    setBrand(v.brand);
                    setModel(v.model);
                  }}
                />
              </View>
            )}
          </View>
        )}

        {/* 3 · Private or taxi — decides the rate */}
        <View style={{ marginTop: space.xl }}>
          <SectionTitle>Vehicle use</SectionTitle>
          <Segmented
            value={category}
            onChange={setCategory}
            options={[
              ['PRIVATE', 'Private'],
              ['TAXI', 'Taxi'],
            ]}
          />
          {category === 'TAXI' && !taxiSupported && (
            <Text style={[s.hint, { marginTop: -space.sm }]}>
              Taxi rates aren’t set up on the server yet — the regular rate applies.
            </Text>
          )}
        </View>

        {/* 4 · Service */}
        <View style={{ marginTop: space.md }}>
          <SectionTitle>Service</SectionTitle>
          {services.loading ? (
            <Loading />
          ) : (
            <View style={s.serviceGrid}>
              {(services.data ?? []).map((x) => {
                const selected = x.id === serviceId;
                return (
                  <Card key={x.id} onPress={() => setServiceId(x.id)} style={[s.serviceTile, selected && s.serviceSelected]}>
                    <Text style={[s.serviceName, selected && { color: '#fff' }]} numberOfLines={2}>
                      {x.name}
                    </Text>
                    <Text style={[s.servicePrice, selected && { color: '#fff' }]}>
                      {formatMoney(rateFor(x, category), config?.currency)}
                    </Text>
                    <Text style={[s.sub, selected && { color: '#DCE8FF' }]}>{formatDuration(x.durationMinutes)}</Text>
                  </Card>
                );
              })}
            </View>
          )}
        </View>

        {/* When — defaults to now */}
        <View style={{ marginTop: space.lg }}>
          {!schedule ? (
            <Text style={s.hint}>
              Starts now — the car joins the queue as Waiting.{' '}
              <Text style={s.link} onPress={() => setSchedule(true)}>
                Schedule for later
              </Text>
            </Text>
          ) : (
            <Card>
              <View style={[s.wrap, { marginBottom: space.md }]}>
                <Chip label="Today" selected={day === 'today'} onPress={() => setDay('today')} />
                <Chip label="Tomorrow" selected={day === 'tomorrow'} onPress={() => setDay('tomorrow')} />
                <Chip label="Back to now" onPress={() => setSchedule(false)} />
              </View>
              <TextField
                label="Start time (24h)"
                value={time}
                onChangeText={setTime}
                placeholder="14:30"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                error={time && !TIME_RE.test(time) ? 'Use HH:MM, e.g. 09:15' : null}
              />
              <TextField label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" />
              <View style={s.switchRow}>
                <Text style={[s.name, { flex: 1, fontSize: 15 }]}>Car is here — add to queue now</Text>
                <Switch value={willCheckIn} onValueChange={setCheckInNow} disabled={day === 'tomorrow'} trackColor={{ true: colors.primary }} />
              </View>
            </Card>
          )}
        </View>

        <Button
          title={
            step ??
            (willCheckIn
              ? `Start wash${service ? ` · ${formatMoney(rateFor(service, category), config?.currency)}` : ''}`
              : 'Create booking')
          }
          icon={willCheckIn ? 'water' : 'calendar'}
          onPress={submit}
          disabled={step !== null || !settled || !serviceId}
          style={{ marginTop: space.xl }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  customerCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderColor: colors.success, borderWidth: 1.5 },
  newBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginBottom: space.md,
  },
  newBannerText: { color: colors.primaryDark, fontWeight: '700', fontSize: 13 },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm, paddingVertical: space.md },
  selectedBorder: { borderColor: colors.primary, borderWidth: 1.5 },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  serviceTile: { width: '48.5%', padding: space.md, minHeight: 96 },
  serviceSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  serviceName: { fontSize: 15, fontWeight: '700', color: colors.text },
  servicePrice: { fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  reg: { fontSize: 17, fontWeight: '800', color: colors.text, letterSpacing: 0.5 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  hint: { fontSize: 13, color: colors.muted, marginBottom: 6 },
  link: { color: colors.primary, fontWeight: '700' },
});
