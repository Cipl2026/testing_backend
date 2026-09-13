export enum ProviderSettlementKind {
  /** Platform collected online — owes provider their share */
  PAYOUT_TO_PROVIDER = 'PAYOUT_TO_PROVIDER',
  /** Customer paid cash to provider — provider owes platform commission */
  COMMISSION_FROM_PROVIDER = 'COMMISSION_FROM_PROVIDER',
}

export enum ProviderSettlementStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SETTLED = 'SETTLED',
  CANCELLED = 'CANCELLED',
}

export enum ProviderSettlementPaymentChannel {
  ONLINE = 'ONLINE',
  CASH = 'CASH',
}
