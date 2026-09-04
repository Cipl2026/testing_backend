import type { OtpDeliveryResult, OtpProvider } from '@/modules/auth/otp/IOtpProvider.js';
import { logger } from '@/utils/logger.js';

export class ConsoleOtpProvider implements OtpProvider {
  async sendOtp(phone: string, otp: string): Promise<OtpDeliveryResult> {
    logger.info('OTP generated for development', { phone, otp });
    return {
      success: true,
      message: 'OTP logged to server console (development only).',
    };
  }
}
