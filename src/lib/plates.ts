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

const STATE_CODES = new Set(PLATE_STATES.map(([code]) => code));

/** Regular plate: KL 07 AB 1234 (series letters optional, district 1–2 digits, number 1–4 digits). */
const STANDARD_RE = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/;
/** Bharat series: YY BH #### XX, e.g. 25 BH 0345 CD (year, "BH", 4 digits, 1–2 letters). */
const BHARAT_RE = /^(\d{2})BH(\d{4})([A-Z]{1,2})$/;

export const PLATE_FORMATS_HINT = 'Accepts KL 07 AB 1234 or Bharat series 25 BH 0345 CD.';

/** Why this plate can't be saved, or null if it's a valid Indian registration number. */
export function plateError(p: PlateParts): string | null {
  if (p.manual !== null) {
    const reg = clean(p.manual);
    if (!reg) return 'Enter the vehicle number.';
    if (BHARAT_RE.test(reg)) return null;
    const m = STANDARD_RE.exec(reg);
    if (!m) return `That doesn’t look like a vehicle number. ${PLATE_FORMATS_HINT}`;
    if (!STATE_CODES.has(m[1])) return `“${m[1]}” isn’t an Indian state code.`;
    if (Number(m[2]) === 0 || Number(m[4]) === 0) return 'The district and number can’t be 0.';
    return null;
  }
  if (!p.state) return 'Choose the state.';
  if (!p.district) return 'Enter the district code, e.g. 07.';
  if (Number(p.district) === 0) return 'The district code can’t be 00.';
  if (!p.number) return 'Enter the number, e.g. 1234.';
  if (Number(p.number) === 0) return 'The number can’t be 0000.';
  return null;
}

export const isPlateComplete = (p: PlateParts) => plateError(p) === null;
