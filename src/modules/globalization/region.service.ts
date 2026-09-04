import mongoose from 'mongoose';
import {
  Region,
  RegionLaunchChecklist,
  RegionalConfiguration,
  TaxPolicy,
  RegionalPaymentPolicy,
  RegionalServiceCatalog,
} from '@/models/Globalization.js';
import {
  LaunchChecklistItemStatus,
  RegionLaunchStatus,
  RegionType,
  TaxInclusionMode,
  GLOBAL_DEFAULT_CURRENCY,
  GLOBAL_DEFAULT_LOCALE,
  GLOBAL_DEFAULT_TIMEZONE,
  PaymentMethodType,
} from '@ghaarfix/shared-types';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';
import { upsertRegionalConfiguration } from '@/modules/globalization/regional-config.service.js';

const CHECKLIST_ITEMS = [
  { key: 'currency', label: 'Currency configured' },
  { key: 'timezone', label: 'Timezone configured' },
  { key: 'catalog', label: 'Service catalog available' },
  { key: 'providers', label: 'Provider availability' },
  { key: 'payments', label: 'Payment methods configured' },
  { key: 'pricing', label: 'Pricing policies set' },
  { key: 'tax', label: 'Tax policy configured' },
  { key: 'notifications', label: 'Notification templates' },
  { key: 'support', label: 'Support contact configured' },
  { key: 'feature_flags', label: 'Feature flags reviewed' },
];

export async function seedGlobalRegion(): Promise<void> {
  const global = await Region.findOneAndUpdate(
    { code: 'GLOBAL' },
    {
      name: 'Global',
      code: 'GLOBAL',
      type: RegionType.GLOBAL,
      timezone: GLOBAL_DEFAULT_TIMEZONE,
      currencyCode: GLOBAL_DEFAULT_CURRENCY,
      locale: GLOBAL_DEFAULT_LOCALE,
      isActive: true,
      launchStatus: RegionLaunchStatus.ACTIVE,
      serviceAvailability: true,
    },
    { upsert: true, new: true },
  );

  const india = await Region.findOneAndUpdate(
    { code: 'IN' },
    {
      name: 'India',
      code: 'IN',
      type: RegionType.COUNTRY,
      parentId: global._id,
      countryCode: 'IN',
      timezone: 'Asia/Kolkata',
      currencyCode: 'INR',
      locale: 'en-IN',
      isActive: true,
      launchStatus: RegionLaunchStatus.ACTIVE,
      serviceAvailability: true,
    },
    { upsert: true, new: true },
  );

  await upsertRegionalConfiguration(india._id.toString(), {
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    defaultLocale: 'en-IN',
    supportedLocales: ['en-IN', 'hi-IN'],
    paymentMethods: [PaymentMethodType.UPI, PaymentMethodType.CARD, PaymentMethodType.PAY_ON_SERVICE],
  });

  await TaxPolicy.findOneAndUpdate(
    { regionId: india._id, name: 'India GST' },
    {
      regionId: india._id,
      name: 'India GST',
      ratePercent: 18,
      inclusionMode: TaxInclusionMode.EXCLUSIVE,
      isActive: true,
    },
    { upsert: true },
  );

  await RegionalPaymentPolicy.findOneAndUpdate(
    { regionId: india._id },
    {
      regionId: india._id,
      methods: [
        { methodType: PaymentMethodType.UPI, enabled: true, gateway: 'razorpay' },
        { methodType: PaymentMethodType.CARD, enabled: true, gateway: 'razorpay' },
        { methodType: PaymentMethodType.PAY_ON_SERVICE, enabled: true },
      ],
      defaultGateway: 'razorpay',
      isActive: true,
    },
    { upsert: true },
  );
}

export async function listRegions(type?: RegionType, parentId?: string) {
  const query: Record<string, unknown> = {};
  if (type) query.type = type;
  if (parentId) query.parentId = parentId;
  const rows = await Region.find(query).sort({ type: 1, name: 1 });
  return rows.map((r) => serializeRegion(r));
}

export async function getRegion(id: string) {
  const region = await Region.findById(id);
  if (!region) throw new AppError('Region not found.', 404, ErrorCode.NOT_FOUND);
  return serializeRegion(region);
}

export async function createRegion(input: {
  name: string;
  code: string;
  type: RegionType;
  parentId?: string;
  countryCode?: string;
  timezone: string;
  currencyCode: string;
  locale: string;
  cityId?: string;
  serviceZoneId?: string;
}) {
  const existing = await Region.findOne({ code: input.code.toUpperCase() });
  if (existing) {
    throw new AppError('Region code already exists.', 409, ErrorCode.CONFLICT);
  }
  const region = await Region.create({
    ...input,
    code: input.code.toUpperCase(),
    parentId: input.parentId && mongoose.Types.ObjectId.isValid(input.parentId)
      ? new mongoose.Types.ObjectId(input.parentId)
      : undefined,
    cityId: input.cityId && mongoose.Types.ObjectId.isValid(input.cityId)
      ? new mongoose.Types.ObjectId(input.cityId)
      : undefined,
    serviceZoneId: input.serviceZoneId && mongoose.Types.ObjectId.isValid(input.serviceZoneId)
      ? new mongoose.Types.ObjectId(input.serviceZoneId)
      : undefined,
    launchStatus: RegionLaunchStatus.DRAFT,
    isActive: false,
    serviceAvailability: false,
  });
  await RegionLaunchChecklist.create({
    regionId: region._id,
    items: CHECKLIST_ITEMS.map((i) => ({
      ...i,
      status: LaunchChecklistItemStatus.PENDING,
    })),
    isReady: false,
  });
  return serializeRegion(region);
}

export async function updateRegion(
  id: string,
  input: Partial<{
    name: string;
    timezone: string;
    currencyCode: string;
    locale: string;
    metadata: Record<string, unknown>;
  }>,
) {
  const region = await Region.findByIdAndUpdate(id, input, { new: true });
  if (!region) throw new AppError('Region not found.', 404, ErrorCode.NOT_FOUND);
  return serializeRegion(region);
}

export async function validateLaunchChecklist(regionId: string) {
  const region = await Region.findById(regionId);
  if (!region) throw new AppError('Region not found.', 404, ErrorCode.NOT_FOUND);

  const config = await RegionalConfiguration.findOne({ regionId }).sort({ version: -1 });
  const catalogCount = await RegionalServiceCatalog.countDocuments({
    regionId,
    status: 'AVAILABLE',
  });
  const payment = await RegionalPaymentPolicy.findOne({ regionId, isActive: true });
  const tax = await TaxPolicy.findOne({ regionId, isActive: true });

  const checks: Array<{ key: string; label: string; status: LaunchChecklistItemStatus; message?: string }> = [
    {
      key: 'currency',
      label: 'Currency configured',
      status: config?.currency ? LaunchChecklistItemStatus.PASSED : LaunchChecklistItemStatus.FAILED,
    },
    {
      key: 'timezone',
      label: 'Timezone configured',
      status: config?.timezone ? LaunchChecklistItemStatus.PASSED : LaunchChecklistItemStatus.FAILED,
    },
    {
      key: 'catalog',
      label: 'Service catalog available',
      status: catalogCount > 0 ? LaunchChecklistItemStatus.PASSED : LaunchChecklistItemStatus.FAILED,
      message: catalogCount > 0 ? `${catalogCount} services` : 'No services in regional catalog',
    },
    {
      key: 'payments',
      label: 'Payment methods configured',
      status: payment?.methods?.some((m) => m.enabled)
        ? LaunchChecklistItemStatus.PASSED
        : LaunchChecklistItemStatus.FAILED,
    },
    {
      key: 'tax',
      label: 'Tax policy configured',
      status: tax ? LaunchChecklistItemStatus.PASSED : LaunchChecklistItemStatus.FAILED,
    },
    {
      key: 'feature_flags',
      label: 'Feature flags reviewed',
      status: LaunchChecklistItemStatus.PASSED,
    },
  ];

  const isReady = checks.every((c) => c.status === LaunchChecklistItemStatus.PASSED);
  await RegionLaunchChecklist.findOneAndUpdate(
    { regionId },
    {
      items: checks.map((c) => ({ ...c, checkedAt: new Date() })),
      isReady,
    },
    { upsert: true },
  );
  return { items: checks, isReady };
}

export async function activateRegion(regionId: string) {
  const checklist = await validateLaunchChecklist(regionId);
  if (!checklist.isReady) {
    throw new AppError(
      'Region launch checklist not complete.',
      400,
      ErrorCode.VALIDATION_ERROR,
    );
  }
  const region = await Region.findByIdAndUpdate(
    regionId,
    {
      isActive: true,
      launchStatus: RegionLaunchStatus.ACTIVE,
      serviceAvailability: true,
    },
    { new: true },
  );
  if (!region) throw new AppError('Region not found.', 404, ErrorCode.NOT_FOUND);
  return serializeRegion(region);
}

export async function deactivateRegion(regionId: string) {
  const region = await Region.findByIdAndUpdate(
    regionId,
    {
      isActive: false,
      launchStatus: RegionLaunchStatus.INACTIVE,
      serviceAvailability: false,
    },
    { new: true },
  );
  if (!region) throw new AppError('Region not found.', 404, ErrorCode.NOT_FOUND);
  return serializeRegion(region);
}

export async function getLaunchChecklist(regionId: string) {
  let checklist = await RegionLaunchChecklist.findOne({ regionId });
  if (!checklist) {
    const validated = await validateLaunchChecklist(regionId);
    return validated;
  }
  return { items: checklist.items, isReady: checklist.isReady };
}

function serializeRegion(r: InstanceType<typeof Region>) {
  return {
    id: r._id.toString(),
    name: r.name,
    code: r.code,
    type: r.type,
    parentId: r.parentId?.toString(),
    countryCode: r.countryCode,
    timezone: r.timezone,
    currencyCode: r.currencyCode,
    locale: r.locale,
    isActive: r.isActive,
    launchStatus: r.launchStatus,
    serviceAvailability: r.serviceAvailability,
    cityId: r.cityId?.toString(),
    serviceZoneId: r.serviceZoneId?.toString(),
    metadata: r.metadata,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}
