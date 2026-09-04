import mongoose, { type Document, Schema, Types } from 'mongoose';
import { BenefitPeriod, PlanBenefitType } from '@ghaarfix/shared-types';

export interface IPlanBenefit extends Document {
  planId: Types.ObjectId;
  planVersionId: Types.ObjectId;
  type: PlanBenefitType;
  serviceId?: Types.ObjectId;
  categoryId?: Types.ObjectId;
  assetTypeId?: Types.ObjectId;
  quantity: number;
  period: BenefitPeriod;
  rules?: Record<string, unknown>;
  priority: number;
  isActive: boolean;
  label?: string;
  createdAt: Date;
  updatedAt: Date;
}

const planBenefitSchema = new Schema<IPlanBenefit>(
  {
    planId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true, index: true },
    planVersionId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlanVersion', required: true, index: true },
    type: { type: String, enum: Object.values(PlanBenefitType), required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', sparse: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', sparse: true },
    assetTypeId: { type: Schema.Types.ObjectId, ref: 'AssetType', sparse: true },
    quantity: { type: Number, required: true, min: 0 },
    period: { type: String, enum: Object.values(BenefitPeriod), required: true },
    rules: { type: Schema.Types.Mixed },
    priority: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    label: { type: String, maxlength: 200 },
  },
  { timestamps: true },
);

planBenefitSchema.index({ planVersionId: 1, type: 1, serviceId: 1 });

export const PlanBenefit = mongoose.model<IPlanBenefit>('PlanBenefit', planBenefitSchema);
