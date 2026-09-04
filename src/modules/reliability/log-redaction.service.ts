const SENSITIVE_KEYS = new Set([
  'password',
  'otp',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'authorization',
  'cookie',
  'card',
  'cardnumber',
  'card_number',
  'cvv',
  'secret',
  'apikey',
  'api_key',
  'razorpay',
]);

const PHONE_PATTERN = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `***${digits.slice(-4)}`;
}

function maskEmail(value: string): string {
  const [local, domain] = value.split('@');
  if (!domain) return '***@***';
  return `${local.slice(0, 1)}***@${domain}`;
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_]/g, '');
  return [...SENSITIVE_KEYS].some((s) => normalized.includes(s.replace(/[-_]/g, '')));
}

function redactString(value: string): string {
  return value
    .replace(PHONE_PATTERN, (m) => maskPhone(m))
    .replace(EMAIL_PATTERN, (m) => maskEmail(m));
}

export function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[MAX_DEPTH]';
  if (value == null) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((v) => redactValue(v, depth + 1));
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) };
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = redactValue(val, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

export function redactHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(headers)) {
    if (isSensitiveKey(key)) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = redactValue(val);
    }
  }
  return out;
}

export function sanitizeDlqPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return redactValue(payload) as Record<string, unknown>;
}

export function normalizeStack(stack?: string): string | undefined {
  if (!stack) return undefined;
  return stack
    .split('\n')
    .slice(0, 5)
    .map((line) => line.trim())
    .join('|');
}
