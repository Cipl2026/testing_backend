const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;
const E164_REGEX = /^\+[1-9]\d{9,14}$/;

export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();

  if (trimmed.startsWith('+') && E164_REGEX.test(trimmed)) {
    return trimmed;
  }

  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10 && INDIAN_MOBILE_REGEX.test(digits)) {
    return `+91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith('91') && INDIAN_MOBILE_REGEX.test(digits.slice(2))) {
    return `+${digits}`;
  }

  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }

  throw new Error('Invalid phone number. Use a valid mobile number with country code.');
}

export function isValidPhone(phone: string): boolean {
  try {
    normalizePhone(phone);
    return true;
  } catch {
    return false;
  }
}

export function maskPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  return `${normalized.slice(0, 3)} ${normalized.slice(3, 5)}••• ••${normalized.slice(-3)}`;
}
