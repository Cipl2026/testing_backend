import axios from 'axios';
import { env } from '@/config/env.js';
import { logger } from '@/utils/logger.js';

const NIMBUS_API_URL = 'http://nimbusit.net/api/pushsms';

// DLT-approved template — must match exactly.
const OTP_MESSAGE_TEMPLATE =
  'Your OTP Request for mobile number verification {otp}. Note that the OTP will be valid for the next 10 mins. Regards COGNOSCENTE';

function toNimbusMobile(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

export function isNimbusConfigured(): boolean {
  return Boolean(
    env.nimbus.user && env.nimbus.authKey && env.nimbus.sender && env.nimbus.entityId && env.nimbus.templateId,
  );
}

export async function sendNimbusSms(mobile: string, otp: string): Promise<unknown> {
  const message = OTP_MESSAGE_TEMPLATE.replace('{otp}', otp);

  const response = await axios.get(NIMBUS_API_URL, {
    params: {
      user: env.nimbus.user,
      authkey: env.nimbus.authKey,
      sender: env.nimbus.sender,
      mobile: toNimbusMobile(mobile),
      text: message,
      entityid: env.nimbus.entityId,
      templateid: env.nimbus.templateId,
      rpt: 1,
    },
    timeout: 15_000,
  });

  logger.info('Nimbus SMS API response', { mobile: toNimbusMobile(mobile), data: response.data });
  return response.data;
}
