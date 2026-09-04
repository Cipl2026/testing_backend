import { createHash, randomBytes, randomInt } from 'node:crypto';

export function generateOtp(length: number): string {
  const digits = Array.from({ length }, () => randomInt(0, 10));
  return digits.join('');
}

export function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex');
}

export function verifyOtpHash(otp: string, hash: string): boolean {
  return hashOtp(otp) === hash;
}

export function generateRequestId(): string {
  return randomBytes(16).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
