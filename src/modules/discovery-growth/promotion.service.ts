import {
  ErrorCode,
  PromotionStatus,
  PromotionType,
} from '@ghaarfix/shared-types';
import { Promotion } from '@/models/Promotion.js';
import { PromotionRedemption } from '@/models/PromotionRedemption.js';
import { AppError } from '@/utils/AppError.js';

export interface PromotionValidationInput {
  code: string;
  customerId: string;
  orderAmount: number;
  serviceId?: string;
  categoryId?: string;
  region?: string;
}

export async function validatePromotion(input: PromotionValidationInput) {
  const promotion = await Promotion.findOne({ code: input.code.toUpperCase() });
  if (!promotion) {
    throw new AppError('Promotion not found.', 404, ErrorCode.NOT_FOUND);
  }

  const now = new Date();
  if (promotion.status !== PromotionStatus.ACTIVE) {
    throw new AppError('Promotion is not active.', 400, ErrorCode.VALIDATION_ERROR);
  }
  if (now < promotion.validFrom || now > promotion.validTo) {
    throw new AppError('Promotion is not valid at this time.', 400, ErrorCode.VALIDATION_ERROR);
  }
  if (promotion.minimumOrder && input.orderAmount < promotion.minimumOrder) {
    throw new AppError(
      `Minimum order amount is ${promotion.minimumOrder}.`,
      400,
      ErrorCode.VALIDATION_ERROR,
    );
  }
  if (promotion.usageLimit && promotion.usageCount >= promotion.usageLimit) {
    throw new AppError('Promotion usage limit reached.', 400, ErrorCode.VALIDATION_ERROR);
  }
  if (promotion.perCustomerLimit) {
    const customerUsage = await PromotionRedemption.countDocuments({
      promotionId: promotion._id,
      customerId: input.customerId,
    });
    if (customerUsage >= promotion.perCustomerLimit) {
      throw new AppError('Promotion per-customer limit reached.', 400, ErrorCode.VALIDATION_ERROR);
    }
  }
  if (promotion.serviceIds.length > 0 && input.serviceId) {
    const allowed = promotion.serviceIds.some((id) => id.toString() === input.serviceId);
    if (!allowed) {
      throw new AppError('Promotion not valid for this service.', 400, ErrorCode.VALIDATION_ERROR);
    }
  }
  if (promotion.categoryIds.length > 0 && input.categoryId) {
    const allowed = promotion.categoryIds.some((id) => id.toString() === input.categoryId);
    if (!allowed) {
      throw new AppError('Promotion not valid for this category.', 400, ErrorCode.VALIDATION_ERROR);
    }
  }
  if (promotion.regions.length > 0 && input.region) {
    if (!promotion.regions.includes(input.region)) {
      throw new AppError('Promotion not valid in this region.', 400, ErrorCode.VALIDATION_ERROR);
    }
  }

  let discountAmount = 0;
  if (promotion.type === PromotionType.PERCENTAGE) {
    discountAmount = (input.orderAmount * promotion.value) / 100;
    if (promotion.maximumDiscount) {
      discountAmount = Math.min(discountAmount, promotion.maximumDiscount);
    }
  } else {
    discountAmount = promotion.value;
  }
  discountAmount = Math.min(discountAmount, input.orderAmount);

  return {
    promotionId: promotion._id.toString(),
    code: promotion.code,
    type: promotion.type,
    discountAmount,
    finalAmount: input.orderAmount - discountAmount,
  };
}

export async function redeemPromotion(
  promotionId: string,
  customerId: string,
  discountAmount: number,
  bookingId?: string,
) {
  const promotion = await Promotion.findOneAndUpdate(
    {
      _id: promotionId,
      $or: [{ usageLimit: { $exists: false } }, { $expr: { $lt: ['$usageCount', '$usageLimit'] } }],
    },
    { $inc: { usageCount: 1 } },
    { new: true },
  );

  if (!promotion) {
    throw new AppError('Promotion usage limit reached.', 409, ErrorCode.CONFLICT);
  }

  await PromotionRedemption.create({
    promotionId: promotion._id,
    customerId,
    bookingId,
    discountAmount,
  });

  return promotion;
}

export async function listActivePromotions() {
  const now = new Date();
  const items = await Promotion.find({
    status: PromotionStatus.ACTIVE,
    validFrom: { $lte: now },
    validTo: { $gte: now },
  }).sort({ createdAt: -1 });

  return items.map((p) => ({
    id: p._id.toString(),
    code: p.code,
    type: p.type,
    value: p.value,
    minimumOrder: p.minimumOrder,
    maximumDiscount: p.maximumDiscount,
    validTo: p.validTo.toISOString(),
  }));
}

export async function listPromotions() {
  return Promotion.find().sort({ createdAt: -1 });
}

export async function createPromotion(data: Partial<InstanceType<typeof Promotion>>) {
  return Promotion.create(data);
}

export async function updatePromotion(id: string, data: Partial<InstanceType<typeof Promotion>>) {
  return Promotion.findByIdAndUpdate(id, data, { new: true });
}

export async function deletePromotion(id: string) {
  return Promotion.findByIdAndDelete(id);
}
