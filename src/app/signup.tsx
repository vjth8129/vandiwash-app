import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, ScrollView, StyleSheet, Text, View, type TextInput } from 'react-native';

import { authApi, errorMessage } from '@/api';
import { colors, radius, space } from '@/components/theme';
import { toast } from '@/components/Toast';
import { Button, Card, PasswordField, SectionTitle, TextField } from '@/components/ui';
import { getCurrentLocation, LocationError, type PickedLocation } from '@/lib/location';
import { PASSWORD_RULES } from '@/lib/password';
import {
  confirmPasswordError,
  emailError,
  firstError,
  gstinError,
  nameError,
  newPasswordError,
  optionalPhoneError,
  phoneError,
  requiredError,
} from '@/lib/validation';

const EMPTY = {
  name: '',
  gstNumber: '',
  businessPhone: '',
  businessEmail: '',
  address: '',
  city: '',
  state: '',
  postalCode: '',
  ownerName: '',
  ownerPhone: '',
  ownerEmail: '',
  password: '',
  confirm: '',
};

/**
 * A car wash owner signs up their car wash. The details (with GSTIN and the shop's GPS
 * location) go to the Vahanly team for review; the owner can sign in once it's activated.
 */
export default function SignupScreen() {
  const [form, setForm] = useState(EMPTY);
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const passwordRef = useRef<TextInput>(null);

  const set = (key: keyof typeof EMPTY) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const errors = {
    name: nameError(form.name, 'car wash name'),
    gstNumber: gstinError(form.gstNumber),
    businessPhone: optionalPhoneError(form.businessPhone, 'business phone'),
    businessEmail: emailError(form.businessEmail),
    location: location ? null : 'Tap “Use my current location” while you’re at the car wash.',
    address: requiredError(form.address, 'shop address', 5),
    city: requiredError(form.city, 'city'),
    state: requiredError(form.state, 'state'),
    postalCode: /^\d{6}$/.test(form.postalCode.trim()) ? null : 'Enter the 6-digit PIN code.',
    ownerName: nameError(form.ownerName, 'your name'),
    ownerPhone: phoneError(form.ownerPhone),
    ownerEmail: emailError(form.ownerEmail),
    password: newPasswordError(form.password),
    confirm: confirmPasswordError(form.password, form.confirm),
  };
  const shown = (key: keyof typeof errors) => (showErrors ? errors[key] : null);

  const locate = async () => {
    setLocating(true);
    try {
      const picked = await getCurrentLocation();
      setLocation(picked);
      // Fill in what the phone could work out, without overwriting what the owner typed.
      const found = picked.address;
      if (found) {
        setForm((f) => ({
          ...f,
          address: f.address || found.line,
          city: f.city || found.city,
          state: f.state || found.state,
          postalCode: f.postalCode || found.postalCode,
        }));
      }
      toast.success(found ? 'Location saved. Check the address below.' : 'Location saved.');
    } catch (e) {
      toast.error(e instanceof LocationError ? e.message : errorMessage(e));
    } finally {
      setLocating(false);
    }
  };

  const submit = async () => {
    setShowErrors(true);
    const problem = firstError(errors);
    if (problem || !location) return toast.error(problem ?? errors.location!);
    setSubmitting(true);
    const optional = (v: string) => v.trim() || undefined;
    try {
      const result = await authApi.signup({
        name: form.name.trim(),
        gstNumber: form.gstNumber.trim().toUpperCase(),
        phone: optional(form.businessPhone),
        email: optional(form.businessEmail),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        postalCode: form.postalCode.trim(),
        country: 'India',
        latitude: location.latitude,
        longitude: location.longitude,
        owner: {
          name: form.ownerName.trim(),
          phone: form.ownerPhone.trim(),
          email: optional(form.ownerEmail),
          password: form.password,
        },
      });
      router.replace({ pathname: '/pending', params: { name: result.carWash.name } });
    } catch (e) {
      toast.error(errorMessage(e));
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView ref={scrollRef} contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.intro}>
          Tell us about your car wash. Our team checks the details and activates your account, usually within 2 hours.
        </Text>

        <SectionTitle>Car wash</SectionTitle>
        <Card style={s.card}>
          <TextField label="Car wash name" value={form.name} onChangeText={set('name')} error={shown('name')} maxLength={150} />
          <TextField
            label="GSTIN"
            value={form.gstNumber}
            onChangeText={(t) => set('gstNumber')(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={15}
            placeholder="e.g. 29ABCDE1234F1Z5"
            error={shown('gstNumber')}
          />
          <TextField
            label="Business phone (optional)"
            value={form.businessPhone}
            onChangeText={set('businessPhone')}
            keyboardType="phone-pad"
            error={shown('businessPhone')}
          />
          <TextField
            label="Business email (optional)"
            value={form.businessEmail}
            onChangeText={set('businessEmail')}
            keyboardType="email-address"
            autoCapitalize="none"
            error={shown('businessEmail')}
          />
        </Card>

        <SectionTitle>Location</SectionTitle>
        <Card style={s.card}>
          {location ? (
            <View style={s.locationRow}>
              <Ionicons name="location" size={22} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={s.locationTitle}>Location saved</Text>
                <Text style={s.muted}>
                  {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                </Text>
              </View>
              <Text
                style={s.link}
                onPress={() =>
                  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`)
                }>
                View map
              </Text>
            </View>
          ) : (
            <Text style={[s.muted, { marginBottom: space.md }]}>
              Stand at your car wash and tap the button so customers and our team can find it.
            </Text>
          )}
          <Button
            title={location ? 'Update location' : 'Use my current location'}
            icon="navigate"
            variant={location ? 'secondary' : 'primary'}
            loading={locating}
            onPress={locate}
          />
          {shown('location') && <Text style={s.error}>{errors.location}</Text>}

          <View style={{ height: space.lg }} />
          <TextField
            label="Shop address"
            value={form.address}
            onChangeText={set('address')}
            placeholder="Building, street, area"
            multiline
            error={shown('address')}
          />
          <TextField label="City" value={form.city} onChangeText={set('city')} error={shown('city')} maxLength={100} />
          <TextField label="State" value={form.state} onChangeText={set('state')} error={shown('state')} maxLength={100} />
          <TextField
            label="PIN code"
            value={form.postalCode}
            onChangeText={(t) => set('postalCode')(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            maxLength={6}
            error={shown('postalCode')}
          />
        </Card>

        <SectionTitle>Your account</SectionTitle>
        <Card style={s.card}>
          <TextField label="Your name" value={form.ownerName} onChangeText={set('ownerName')} error={shown('ownerName')} />
          <TextField
            label="Mobile number"
            value={form.ownerPhone}
            onChangeText={set('ownerPhone')}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="e.g. 98765 43210"
            hint="You’ll sign in with this number."
            error={shown('ownerPhone')}
          />
          <TextField
            label="Email (optional)"
            value={form.ownerEmail}
            onChangeText={set('ownerEmail')}
            keyboardType="email-address"
            autoCapitalize="none"
            hint="Used to send password reset codes."
            error={shown('ownerEmail')}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <PasswordField
            ref={passwordRef}
            label="Password"
            value={form.password}
            onChangeText={set('password')}
            autoComplete="new-password"
            textContentType="newPassword"
            hint={PASSWORD_RULES}
            error={shown('password')}
          />
          <PasswordField
            label="Confirm password"
            value={form.confirm}
            onChangeText={set('confirm')}
            autoComplete="new-password"
            textContentType="newPassword"
            error={shown('confirm')}
          />
        </Card>

        <Button title="Submit for review" icon="checkmark-circle" onPress={submit} loading={submitting} />
        <Button title="I already have an account" variant="ghost" onPress={() => router.back()} style={{ marginTop: space.sm }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { padding: space.lg, paddingBottom: space.xl * 2, maxWidth: 560, width: '100%', alignSelf: 'center' },
  intro: { color: colors.muted, fontSize: 15, marginBottom: space.lg },
  card: { marginBottom: space.lg },
  muted: { color: colors.muted, fontSize: 14 },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
  },
  locationTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
  link: { color: colors.primary, fontWeight: '600', padding: space.xs },
  error: { color: colors.danger, fontSize: 13, marginTop: space.sm },
});
