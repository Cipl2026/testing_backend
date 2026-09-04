import { ThreatRisk, ThreatStatus } from '@ghaarfix/shared-types';
import { ThreatModel } from '@/models/Security.js';

const DEFAULT_THREATS = [
  {
    asset: 'Customer accounts',
    threat: 'Account takeover via OTP brute force',
    attackVector: 'Automated OTP guessing',
    impact: 'Unauthorized access to bookings and personal data',
    likelihood: 'MEDIUM',
    risk: ThreatRisk.HIGH,
    mitigation: 'OTP rate limiting, attempt limits, expiry, anti-enumeration',
    status: ThreatStatus.MITIGATED,
    owner: 'Security Team',
  },
  {
    asset: 'Payment webhooks',
    threat: 'Webhook forgery',
    attackVector: 'Forged payment confirmation',
    impact: 'False payment confirmation',
    likelihood: 'LOW',
    risk: ThreatRisk.CRITICAL,
    mitigation: 'HMAC signature verification, idempotency, replay window',
    status: ThreatStatus.OPEN,
    owner: 'Payments Team',
  },
  {
    asset: 'Admin panel',
    threat: 'Privilege escalation',
    attackVector: 'Unauthorized role change',
    impact: 'Full platform compromise',
    likelihood: 'LOW',
    risk: ThreatRisk.CRITICAL,
    mitigation: 'RBAC, step-up auth, audit logs, separation of duties',
    status: ThreatStatus.MITIGATED,
    owner: 'Security Team',
  },
  {
    asset: 'Booking resources',
    threat: 'IDOR on booking access',
    attackVector: 'Direct API access with foreign bookingId',
    impact: 'Exposure of booking details',
    likelihood: 'MEDIUM',
    risk: ThreatRisk.HIGH,
    mitigation: 'Ownership checks on all booking endpoints',
    status: ThreatStatus.MITIGATED,
    owner: 'Platform Team',
  },
  {
    asset: 'File uploads',
    threat: 'Malicious file upload',
    attackVector: 'Upload executable disguised as image',
    impact: 'Malware distribution or server compromise',
    likelihood: 'MEDIUM',
    risk: ThreatRisk.HIGH,
    mitigation: 'MIME whitelist, size limits, content validation, signed URLs',
    status: ThreatStatus.OPEN,
    owner: 'Platform Team',
  },
];

export async function seedThreatModel(): Promise<void> {
  for (const threat of DEFAULT_THREATS) {
    await ThreatModel.findOneAndUpdate(
      { asset: threat.asset, threat: threat.threat },
      { ...threat, lastReviewedAt: new Date() },
      { upsert: true },
    );
  }
}

export async function listThreatModels(risk?: ThreatRisk) {
  const query = risk ? { risk } : {};
  return ThreatModel.find(query).sort({ risk: -1 });
}

export async function upsertThreatModel(input: {
  asset: string;
  threat: string;
  attackVector: string;
  impact: string;
  likelihood: string;
  risk: ThreatRisk;
  mitigation: string;
  status?: ThreatStatus;
  owner?: string;
}) {
  return ThreatModel.findOneAndUpdate(
    { asset: input.asset, threat: input.threat },
    { ...input, lastReviewedAt: new Date() },
    { upsert: true, new: true },
  );
}
