import { randomBytes } from 'node:crypto';

export function generateInvoiceNumber(): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const suffix = randomBytes(2).toString('hex').toUpperCase();
  return `GF-INV-${y}${m}${d}-${suffix}`;
}

export function generateTicketNumber(): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const suffix = randomBytes(2).toString('hex').toUpperCase();
  return `TKT-${y}${m}${d}-${suffix}`;
}

export function generateClaimNumber(): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const suffix = randomBytes(2).toString('hex').toUpperCase();
  return `CLM-${y}${m}${d}-${suffix}`;
}
