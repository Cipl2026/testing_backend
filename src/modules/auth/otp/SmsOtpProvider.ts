import type { OtpDeliveryResult, OtpProvider } from '@/modules/auth/otp/IOtpProvider.js';
import { isNimbusConfigured, sendNimbusSms } from '@/modules/auth/otp/nimbusSms.js';
import { logger } from '@/utils/logger.js';

export class SmsOtpProvider implements OtpProvider {
  async sendOtp(phone: string, otp: string): Promise<OtpDeliveryResult> {
    if (!isNimbusConfigured()) {
      logger.warn('SMS OTP provider is not configured', { phone });
      return {
        success: false,
        message: 'SMS delivery is not configured.',
      };
    }

    try {
      await sendNimbusSms(phone, otp);
      return {
        success: true,
        message: 'OTP sent via SMS.',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const responseData =
        axiosLikeError(error) ? error.response?.data : undefined;

      logger.error('Nimbus SMS sending failed', { phone, message, responseData });
      return {
        success: false,
        message: 'Failed to send OTP SMS.',
      };
    }
  }
}

function axiosLikeError(
  error: unknown,
): error is { response?: { data?: unknown }; message?: string } {
  return typeof error === 'object' && error !== null && 'response' in error;
}
