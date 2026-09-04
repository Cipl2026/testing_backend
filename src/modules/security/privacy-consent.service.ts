import {
  ConsentStatus,
  ConsentType,
} from '@ghaarfix/shared-types';
import { PrivacyConsentRecord } from '@/models/Security.js';
import { updateConsent as updateMarketingConsent } from '@/modules/customer-lifecycle/consent.service.js';
import { logSecurityAudit } from '@/modules/security/security-audit.service.js';

export async function getPrivacyConsents(userId: string) {
  const records = await PrivacyConsentRecord.find({ userId });
  const map = Object.fromEntries(records.map((r) => [r.consentType, r]));

  return {
    terms: map[ConsentType.TERMS]?.status ?? ConsentStatus.PENDING,
    privacy: map[ConsentType.PRIVACY]?.status ?? ConsentStatus.PENDING,
    marketingPush: map[ConsentType.MARKETING_PUSH]?.status ?? ConsentStatus.WITHDRAWN,
    marketingEmail: map[ConsentType.MARKETING_EMAIL]?.status ?? ConsentStatus.WITHDRAWN,
    marketingSms: map[ConsentType.MARKETING_SMS]?.status ?? ConsentStatus.WITHDRAWN,
    personalization: map[ConsentType.OPTIONAL_PERSONALIZATION]?.status ?? ConsentStatus.WITHDRAWN,
    records: records.map((r) => ({
      consentType: r.consentType,
      status: r.status,
      version: r.version,
      grantedAt: r.grantedAt,
      withdrawnAt: r.withdrawnAt,
    })),
  };
}

export async function updatePrivacyConsent(
  userId: string,
  updates: Partial<Record<ConsentType, ConsentStatus>>,
  source = 'app',
) {
  const results = [];
  for (const [type, status] of Object.entries(updates)) {
    const consentType = type as ConsentType;
    const now = new Date();
    const record = await PrivacyConsentRecord.findOneAndUpdate(
      { userId, consentType },
      {
        status,
        purpose: getPurposeForType(consentType),
        version: '1.0',
        source,
        ...(status === ConsentStatus.GRANTED
          ? { grantedAt: now, withdrawnAt: null }
          : { withdrawnAt: now }),
      },
      { upsert: true, new: true },
    );
    results.push(record);

    if (
      consentType === ConsentType.MARKETING_PUSH ||
      consentType === ConsentType.MARKETING_EMAIL ||
      consentType === ConsentType.MARKETING_SMS
    ) {
      await updateMarketingConsent(userId, {
        marketingOptIn: status === ConsentStatus.GRANTED,
        pushEnabled: consentType === ConsentType.MARKETING_PUSH ? status === ConsentStatus.GRANTED : undefined,
        emailEnabled: consentType === ConsentType.MARKETING_EMAIL ? status === ConsentStatus.GRANTED : undefined,
        smsEnabled: consentType === ConsentType.MARKETING_SMS ? status === ConsentStatus.GRANTED : undefined,
      });
    }
  }

  await logSecurityAudit({
    actorId: userId,
    actorType: 'CUSTOMER',
    action: 'consent.updated',
    metadata: { types: Object.keys(updates) },
  });

  return getPrivacyConsents(userId);
}

function getPurposeForType(type: ConsentType): string {
  const purposes: Record<ConsentType, string> = {
    [ConsentType.TERMS]: 'Service terms acceptance',
    [ConsentType.PRIVACY]: 'Privacy policy acceptance',
    [ConsentType.MARKETING_PUSH]: 'Marketing push notifications',
    [ConsentType.MARKETING_EMAIL]: 'Marketing email communications',
    [ConsentType.MARKETING_SMS]: 'Marketing SMS communications',
    [ConsentType.OPTIONAL_PERSONALIZATION]: 'Optional service personalization',
  };
  return purposes[type];
}

export async function seedDefaultConsents(userId: string): Promise<void> {
  await updatePrivacyConsent(
    userId,
    {
      [ConsentType.TERMS]: ConsentStatus.GRANTED,
      [ConsentType.PRIVACY]: ConsentStatus.GRANTED,
    },
    'registration',
  );
}
