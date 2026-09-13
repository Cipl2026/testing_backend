import { PlatformBranding } from '@/models/PlatformBranding.js';

const DEFAULT_KEY = 'default';

export type PlatformBrandingPayload = {
  customerLogoUrl?: string;
  customerLogoDarkUrl?: string;
  providerLogoUrl?: string;
  providerLogoDarkUrl?: string;
  customerAppName?: string;
  providerAppName?: string;
  customerApiUrl?: string;
  providerApiUrl?: string;
};

function serialize(doc: InstanceType<typeof PlatformBranding> | null) {
  return {
    customerLogoUrl: doc?.customerLogoUrl ?? null,
    customerLogoDarkUrl: doc?.customerLogoDarkUrl ?? null,
    providerLogoUrl: doc?.providerLogoUrl ?? null,
    providerLogoDarkUrl: doc?.providerLogoDarkUrl ?? null,
    customerAppName: doc?.customerAppName ?? 'Ghaarfix',
    providerAppName: doc?.providerAppName ?? 'Ghaarfix Pro',
    customerApiUrl: doc?.customerApiUrl ?? null,
    providerApiUrl: doc?.providerApiUrl ?? null,
    updatedAt: doc?.updatedAt?.toISOString() ?? null,
  };
}

export async function getPlatformBranding() {
  const doc = await PlatformBranding.findOne({ key: DEFAULT_KEY });
  return serialize(doc);
}

export async function updatePlatformBranding(input: PlatformBrandingPayload) {
  const doc = await PlatformBranding.findOneAndUpdate(
    { key: DEFAULT_KEY },
    {
      $set: {
        ...(input.customerLogoUrl !== undefined ? { customerLogoUrl: input.customerLogoUrl || undefined } : {}),
        ...(input.customerLogoDarkUrl !== undefined
          ? { customerLogoDarkUrl: input.customerLogoDarkUrl || undefined }
          : {}),
        ...(input.providerLogoUrl !== undefined ? { providerLogoUrl: input.providerLogoUrl || undefined } : {}),
        ...(input.providerLogoDarkUrl !== undefined
          ? { providerLogoDarkUrl: input.providerLogoDarkUrl || undefined }
          : {}),
        ...(input.customerAppName !== undefined ? { customerAppName: input.customerAppName.trim() || 'Ghaarfix' } : {}),
        ...(input.providerAppName !== undefined
          ? { providerAppName: input.providerAppName.trim() || 'Ghaarfix Pro' }
          : {}),
        ...(input.customerApiUrl !== undefined
          ? { customerApiUrl: input.customerApiUrl.trim() || undefined }
          : {}),
        ...(input.providerApiUrl !== undefined
          ? { providerApiUrl: input.providerApiUrl.trim() || undefined }
          : {}),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return serialize(doc);
}
