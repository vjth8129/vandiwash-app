// Form field checks. Each returns an error message, or null when the value is fine.
// They mirror the API's validators (car-wash-apis src/validators) so problems show up before submitting.

import { isPasswordStrong, PASSWORD_RULES } from './password';

/** Same rule as the server's normalizePhone: 10 digits (optionally 0- or +country-prefixed). */
export function phoneError(value: string, label = 'mobile number'): string | null {
  const trimmed = value.trim();
  if (!trimmed) return `Enter the ${label}.`;
  if (/[^\d+\s\-()]/.test(trimmed)) return `The ${label} can only contain digits.`;
  const digits = trimmed.replace(/\D/g, '');
  let e164: string;
  if (trimmed.startsWith('+')) e164 = digits;
  else if (digits.length === 10) e164 = '91' + digits;
  else if (digits.length === 11 && digits.startsWith('0')) e164 = '91' + digits.slice(1);
  else e164 = digits;
  if (e164.length < 10 || e164.length > 15 || e164.startsWith('0')) return `Enter a valid 10-digit ${label}.`;
  return null;
}

export function nameError(value: string, label = 'name', { min = 2, max = 150 } = {}): string | null {
  const v = value.trim();
  if (!v) return `Enter the ${label}.`;
  if (v.length < min) return `The ${label} must be at least ${min} characters.`;
  if (v.length > max) return `The ${label} must be at most ${max} characters.`;
  return null;
}

export function usernameError(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Enter a username.';
  if (v.length < 3) return 'The username must be at least 3 characters.';
  if (v.length > 100) return 'The username must be at most 100 characters.';
  if (/\s/.test(v)) return 'The username can’t contain spaces.';
  return null;
}

/** Optional field: empty is fine. */
export function emailError(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : 'Enter a valid email address, e.g. name@example.com.';
}

export function newPasswordError(value: string): string | null {
  if (!value) return 'Enter a password.';
  return isPasswordStrong(value) ? null : PASSWORD_RULES;
}

export function confirmPasswordError(password: string, confirm: string): string | null {
  if (!confirm) return 'Type the new password again.';
  return password === confirm ? null : 'The two passwords don’t match.';
}

/** A rupee amount: digits with up to 2 decimals. */
export function amountError(value: string, label: string): string | null {
  const v = value.trim();
  if (!v) return `Enter the ${label}.`;
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return `Enter the ${label} as a number, e.g. 399 or 399.50.`;
  if (Number(v) > 1_000_000) return `The ${label} looks too high.`;
  return null;
}

export function minutesError(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Enter the duration in minutes.';
  if (!/^\d+$/.test(v) || Number(v) <= 0) return 'Enter the duration in whole minutes, e.g. 30.';
  if (Number(v) > 24 * 60) return 'The duration can’t be more than 24 hours.';
  return null;
}

export function maxLengthError(value: string, max: number, label: string): string | null {
  return value.trim().length > max ? `The ${label} must be at most ${max} characters.` : null;
}

/** First message in a set of field errors, for the toast shown when a form is submitted. */
export const firstError = (errors: Record<string, string | null>) => Object.values(errors).find(Boolean) ?? null;
