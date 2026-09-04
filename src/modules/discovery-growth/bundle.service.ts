import { BundlePricingMode, ErrorCode } from '@ghaarfix/shared-types';
import { ServiceBundle } from '@/models/ServiceBundle.js';
import { Service } from '@/models/Service.js';
import { AppError } from '@/utils/AppError.js';

export async function listActiveBundles() {
  const now = new Date();
  return ServiceBundle.find({
    isActive: true,
    validFrom: { $lte: now },
    validTo: { $gte: now },
  }).sort({ createdAt: -1 });
}

export async function getBundleWithPricing(bundleId: string) {
  const bundle = await ServiceBundle.findById(bundleId);
  if (!bundle) {
    throw new AppError('Bundle not found.', 404, ErrorCode.NOT_FOUND);
  }

  const now = new Date();
  if (!bundle.isActive || now < bundle.validFrom || now > bundle.validTo) {
    throw new AppError('Bundle is not currently available.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const services = await Service.find({ _id: { $in: bundle.serviceIds }, isActive: true });
  if (services.length !== bundle.serviceIds.length) {
    throw new AppError('One or more bundle services are unavailable.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const itemPrices = services.map((s) => s.pricing.startingPrice ?? 0);
  const subtotal = itemPrices.reduce((sum, p) => sum + p, 0);

  let totalPrice = subtotal;
  if (bundle.pricingMode === BundlePricingMode.FIXED && bundle.fixedPrice != null) {
    totalPrice = bundle.fixedPrice;
  } else if (bundle.pricingMode === BundlePricingMode.DISCOUNTED && bundle.discount != null) {
    totalPrice = subtotal - (subtotal * bundle.discount) / 100;
  }

  return {
    id: bundle._id.toString(),
    name: bundle.name,
    description: bundle.description,
    pricingMode: bundle.pricingMode,
    services: services.map((s, i) => ({
      id: s._id.toString(),
      name: s.name,
      unitPrice: itemPrices[i],
    })),
    subtotal,
    totalPrice,
    savings: Math.max(0, subtotal - totalPrice),
    currency: services[0]?.pricing.currency ?? 'INR',
  };
}

export async function listBundles() {
  return ServiceBundle.find().sort({ createdAt: -1 });
}

export async function createBundle(data: Partial<InstanceType<typeof ServiceBundle>>) {
  return ServiceBundle.create(data);
}

export async function updateBundle(id: string, data: Partial<InstanceType<typeof ServiceBundle>>) {
  return ServiceBundle.findByIdAndUpdate(id, data, { new: true });
}

export async function deleteBundle(id: string) {
  return ServiceBundle.findByIdAndDelete(id);
}
