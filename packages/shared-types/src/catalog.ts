export enum PricingType {
  STARTING_FROM = 'STARTING_FROM',
  FIXED = 'FIXED',
  INSPECTION_REQUIRED = 'INSPECTION_REQUIRED',
}

export enum ProviderServiceApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface ServicePricing {
  type: PricingType;
  startingPrice?: number;
  currency: string;
}

export interface ServiceDuration {
  minMinutes: number;
  maxMinutes: number;
}

export interface ServiceFaq {
  question: string;
  answer: string;
}

export interface ServiceWarranty {
  days?: number;
  description?: string;
}

export interface ProviderCustomPricing {
  enabled: boolean;
  visitCharge?: number;
  startingPrice?: number;
  notes?: string;
}
"}},{"type":"tool_use","name":"Write","input":{"path":"/Users/deependrakumar/Downloads/Ghaarfix/server/shared-types/src/booking.ts","contents":"