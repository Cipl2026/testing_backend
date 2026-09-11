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

  assertGatewayAccepted(response.data);
  return response.data;
}

/**
 * Nimbus reports failures inside the response body with an HTTP 200 status,
 * e.g. {"STATUS":"ERROR","RESPONSE":{"CODE":"200","INFO":"AUTHENTICATION FAILURE"}}.
 * Without this check the app would say "OTP sent successfully" even though the
 * message was never delivered, which is a common cause of "OTP expired or wrong"
 * the moment the user tries to verify. Fail fast when the gateway says so.
 */
function assertGatewayAccepted(data: unknown): void {
  if (typeof data !== 'object' || data === null) return;

  const status = String((data as { STATUS?: unknown }).STATUS ?? '').toLowerCase();
  const rejected = status === 'error' || status === 'failure' || status.includes('fail');
  if (!rejected) return;

  const response = (data as { RESPONSE?: unknown }).RESPONSE;
  const info =
    typeof response === 'object' && response !== null
      ? (response as { INFO?: unknown }).INFO
      : undefined;
  const detail = typeof info === 'string' && info ? `: ${info}` : '';

  logger.error('Nimbus SMS gateway rejected the message', { status, info });
  throw new Error(`SMS gateway rejected the message${detail}`);
}
