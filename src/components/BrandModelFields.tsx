import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { modelsFor, VEHICLE_BRANDS, vehicleTypeFor, vehicleTypeLabel } from '@/lib/vehicleCatalog';
import { PickerSheet, SelectField } from './PickerSheet';
import { colors, space } from './theme';

const BRAND_OPTIONS = VEHICLE_BRANDS.map((b) => ({ value: b, label: b }));

type Props = {
  brand: string;
  model: string;
  onChange: (value: { brand: string; model: string }) => void;
};

/**
 * Brand and Model pickers side by side; the model list follows the chosen brand. Both accept typed-in names.
 * The body type is worked out from the model (see vehicleTypeFor) and shown underneath.
 */
export function BrandModelFields({ brand, model, onChange }: Props) {
  const [open, setOpen] = useState<'brand' | 'model' | null>(null);
  const models = modelsFor(brand).map((m) => ({ value: m, label: m }));
  const type = brand ? vehicleTypeFor(brand, model) : undefined;

  const pickBrand = (next: string) => {
    // Keep the model only if the new brand has it (or both are custom).
    const keep = next === brand || (modelsFor(next).length === 0 && modelsFor(brand).length === 0);
    onChange({ brand: next, model: keep ? model : '' });
    setOpen(null);
    // Go straight on to the model.
    setTimeout(() => setOpen('model'), 350);
  };

  return (
    <View style={{ marginBottom: space.md }}>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <SelectField label="Brand" value={brand} placeholder="Choose brand" onPress={() => setOpen('brand')} />
        </View>
        <View style={{ flex: 1 }}>
          <SelectField
            label="Model"
            value={model}
            placeholder={brand ? 'Choose model' : 'Brand first'}
            onPress={() => setOpen('model')}
            disabled={!brand}
          />
        </View>

        <PickerSheet
          visible={open === 'brand'}
          title="Select brand"
          searchPlaceholder="Search brand"
          options={BRAND_OPTIONS}
          selected={brand}
          onPick={pickBrand}
          onClose={() => setOpen(null)}
          allowCustom
        />
        <PickerSheet
          visible={open === 'model'}
          title={`${brand} models`}
          searchPlaceholder="Search model"
          options={models}
          selected={model}
          onPick={(m) => {
            onChange({ brand, model: m });
            setOpen(null);
          }}
          onClose={() => setOpen(null)}
          allowCustom
        />
      </View>
      {type && <Text style={s.type}>Type: {vehicleTypeLabel(type)}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  type: { fontSize: 13, color: colors.muted, marginTop: -space.sm },
});
