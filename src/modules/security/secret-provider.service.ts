import { env } from '@/config/env.js';

const SENSITIVE_ENV_KEYS = new Set([
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'MONGODB_URI',
  'DO_SPACES_SECRET',
  'GEMINI_API_KEY',
  'NIMBUS_AUTHKEY',
]);

export interface SecretProvider {
  getSecret(key: string): string;
  getOptionalSecret(key: string): string | undefined;
  validateRequiredSecrets(keys: string[]): void;
}

class EnvSecretProvider implements SecretProvider {
  getSecret(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Required secret not configured: ${key}`);
    }
    return value;
  }

  getOptionalSecret(key: string): string | undefined {
    return process.env[key] || undefined;
  }

  validateRequiredSecrets(keys: string[]): void {
    const missing = keys.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      throw new Error(`Missing required secrets: ${missing.join(', ')}`);
    }
  }
}

let provider: SecretProvider = new EnvSecretProvider();

export function getSecretProvider(): SecretProvider {
  return provider;
}

export function setSecretProvider(next: SecretProvider): void {
  provider = next;
}

export function validateProductionSecrets(): void {
  if (!env.isProd) return;
  const required = ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
  if (env.razorpay.keyId) {
    required.push('RAZORPAY_KEY_SECRET');
  }
  provider.validateRequiredSecrets(required);
}

export function isSensitiveEnvKey(key: string): boolean {
  return SENSITIVE_ENV_KEYS.has(key);
}
