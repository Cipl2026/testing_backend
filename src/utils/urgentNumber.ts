import { randomBytes } from 'node:crypto';
import { DateTime } from 'luxon';
import { UrgentRequest } from '@/models/UrgentRequest.js';

export async function generateUrgentRequestNumber(): Promise<string> {
  const datePart = DateTime.now().setZone('Asia/Kolkata').toFormat('yyyyMMdd');
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = randomBytes(2).toString('hex').toUpperCase().slice(0, 4);
    const number = `URG-${datePart}-${suffix}`;
    const exists = await UrgentRequest.exists({ requestNumber: number });
    if (!exists) return number;
  }
  const suffix = randomBytes(3).toString('hex').toUpperCase();
  return `URG-${datePart}-${suffix}`;
}
