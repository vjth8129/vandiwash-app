/** Indian registration-number state / UT codes (the first part of a number plate). */
export const PLATE_STATES: readonly (readonly [code: string, name: string])[] = [
  ['AN', 'Andaman & Nicobar Islands'],
  ['AP', 'Andhra Pradesh'],
  ['AR', 'Arunachal Pradesh'],
  ['AS', 'Assam'],
  ['BR', 'Bihar'],
  ['CG', 'Chhattisgarh'],
  ['CH', 'Chandigarh'],
  ['DD', 'Dadra & Nagar Haveli and Daman & Diu'],
  ['DL', 'Delhi'],
  ['DN', 'Dadra & Nagar Haveli (old)'],
  ['GA', 'Goa'],
  ['GJ', 'Gujarat'],
  ['HP', 'Himachal Pradesh'],
  ['HR', 'Haryana'],
  ['JH', 'Jharkhand'],
  ['JK', 'Jammu & Kashmir'],
  ['KA', 'Karnataka'],
  ['KL', 'Kerala'],
  ['LA', 'Ladakh'],
  ['LD', 'Lakshadweep'],
  ['MH', 'Maharashtra'],
  ['ML', 'Meghalaya'],
  ['MN', 'Manipur'],
  ['MP', 'Madhya Pradesh'],
  ['MZ', 'Mizoram'],
  ['NL', 'Nagaland'],
  ['OD', 'Odisha'],
  ['OR', 'Odisha (old)'],
  ['PB', 'Punjab'],
  ['PY', 'Puducherry'],
  ['RJ', 'Rajasthan'],
  ['SK', 'Sikkim'],
  ['TG', 'Telangana'],
  ['TN', 'Tamil Nadu'],
  ['TR', 'Tripura'],
  ['TS', 'Telangana (old)'],
  ['UA', 'Uttarakhand (old)'],
  ['UK', 'Uttarakhand'],
  ['UP', 'Uttar Pradesh'],
  ['WB', 'West Bengal'],
];

export const DEFAULT_PLATE_STATE = 'KL';

/**
 * A plate split the way it's typed: state · district · series · number, e.g. KL · 07 · AB · 1234.
 * `manual` holds free text for plates that don't fit that pattern (old or special formats).
 */
export type PlateParts = { state: string; district: string; series: string; number: string; manual: string | null };

export const emptyPlate = (): PlateParts => ({
  state: DEFAULT_PLATE_STATE,
  district: '',
  series: '',
  number: '',
  manual: null,
});

const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** → "KL07AB1234" (the form the API stores). */
export const plateString = (p: PlateParts) =>
  clean(p.manual ?? p.state + p.district + p.series + p.number);

/** Series letters are optional; manual entries just need a plausible length. */
export const isPlateComplete = (p: PlateParts) =>
  p.manual !== null ? clean(p.manual).length >= 4 : !!p.state && p.district.length > 0 && p.number.length > 0;
