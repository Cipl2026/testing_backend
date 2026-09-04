import { env } from '@/config/env.js';
import { ConsoleOtpProvider } from '@/modules/auth/otp/ConsoleOtpProvider.js';
import type { OtpProvider } from '@/modules/auth/otp/IOtpProvider.js';
import { isNimbusConfigured } from '@/modules/auth/otp/nimbusSms.js';
import { SmsOtpProvider } from '@/modules/auth/otp/SmsOtpProvider.js';

let provider: OtpProvider | null = null;

export function getOtpProvider(): OtpProvider {
  if (!provider) {
    if (env.isTest) {
      provider = new ConsoleOtpProvider();
    } else if (isNimbusConfigured()) {
      provider = new SmsOtpProvider();
    } else if (env.isProd) {
      provider = new SmsOtpProvider();
    } else {
      provider = new ConsoleOtpProvider();
    }
  }
  return provider;
}
