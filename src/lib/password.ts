// Mirrors the server's password rule (car-wash-apis src/utils/password.ts) so users see it up front.
export const PASSWORD_RULES =
  'At least 8 characters, with an uppercase letter, a lowercase letter, a number and a symbol.';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,}$/;

export const isPasswordStrong = (password: string) => PASSWORD_REGEX.test(password);
