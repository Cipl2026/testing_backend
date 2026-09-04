import crypto from 'node:crypto';
import { PaymentMethod, PaymentStatus } from '@ghaarfix/shared-types';
import { env } from '@/config/env.js';
import { logger } from '@/utils/logger.js';

export interface CreatePaymentOrderInput {
  amount: number;
  currency: string;
  bookingId: string;
  customerId: string;
}

export interface PaymentOrderResult {
  provider: string;
  orderId: string;
  amount: number;
  currency: string;
  keyId?: string;
}

export interface PaymentGateway {
  createPayment(input: CreatePaymentOrderInput): Promise<PaymentOrderResult>;
  verifyPayment(payload: Record<string, unknown>): Promise<{ valid: boolean; paymentId?: string }>;
  handleWebhook(
    payload: Record<string, unknown>,
    signature: string,
  ): Promise<{ orderId?: string; paymentId?: string; status: PaymentStatus }>;
  refundPayment(providerPaymentId: string, amount: number): Promise<void>;
}

class DevPaymentGateway implements PaymentGateway {
  async createPayment(input: CreatePaymentOrderInput): Promise<PaymentOrderResult> {
    return {
      provider: 'dev',
      orderId: `dev_order_${input.bookingId}`,
      amount: input.amount,
      currency: input.currency,
    };
  }

  async verifyPayment(payload: Record<string, unknown>): Promise<{ valid: boolean; paymentId?: string }> {
    if (payload.dev === true || payload.provider === 'dev') {
      return { valid: true, paymentId: `dev_pay_${Date.now()}` };
    }
    return { valid: true, paymentId: `dev_pay_${Date.now()}` };
  }

  async handleWebhook(): Promise<{ status: PaymentStatus }> {
    return { status: PaymentStatus.PAID };
  }

  async refundPayment(): Promise<void> {
    return;
  }
}

class RazorpayPaymentGateway implements PaymentGateway {
  constructor(
    private keyId: string,
    private keySecret: string,
    private webhookSecret: string,
  ) {}

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`;
  }

  async createPayment(input: CreatePaymentOrderInput): Promise<PaymentOrderResult> {
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(input.amount * 100),
        currency: input.currency,
        receipt: input.bookingId.slice(-40),
        notes: { bookingId: input.bookingId, customerId: input.customerId },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error('Razorpay order creation failed', { status: response.status, body });
      throw new Error('Failed to create Razorpay order.');
    }

    const order = (await response.json()) as { id: string; amount: number; currency: string };
    return {
      provider: 'razorpay',
      orderId: order.id,
      amount: input.amount,
      currency: order.currency,
      keyId: this.keyId,
    };
  }

  async verifyPayment(payload: Record<string, unknown>): Promise<{ valid: boolean; paymentId?: string }> {
    const orderId = String(payload.razorpay_order_id ?? '');
    const paymentId = String(payload.razorpay_payment_id ?? '');
    const signature = String(payload.razorpay_signature ?? '');
    if (!orderId || !paymentId || !signature) {
      return { valid: false };
    }
    const expected = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    return { valid: expected === signature, paymentId };
  }

  async handleWebhook(
    payload: Record<string, unknown>,
    signature: string,
  ): Promise<{ orderId?: string; paymentId?: string; status: PaymentStatus }> {
    if (this.webhookSecret) {
      const body = JSON.stringify(payload);
      const expected = crypto.createHmac('sha256', this.webhookSecret).update(body).digest('hex');
      if (expected !== signature) {
        return { status: PaymentStatus.PENDING };
      }
    }

    const event = payload.event as string | undefined;
    const entity = (payload.payload as { payment?: { entity?: Record<string, unknown> } })?.payment
      ?.entity;

    if (event === 'payment.captured' && entity) {
      return {
        orderId: String(entity.order_id ?? ''),
        paymentId: String(entity.id ?? ''),
        status: PaymentStatus.PAID,
      };
    }

    if (event === 'payment.failed') {
      return { status: PaymentStatus.FAILED };
    }

    return { status: PaymentStatus.PENDING };
  }

  async refundPayment(providerPaymentId: string, amount: number): Promise<void> {
    const response = await fetch(`https://api.razorpay.com/v1/payments/${providerPaymentId}/refund`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount: Math.round(amount * 100) }),
    });
    if (!response.ok) {
      logger.warn('Razorpay refund failed', { providerPaymentId, status: response.status });
    }
  }
}

export function getPaymentGateway(): PaymentGateway {
  if (env.razorpay.keyId && env.razorpay.keySecret) {
    return new RazorpayPaymentGateway(
      env.razorpay.keyId,
      env.razorpay.keySecret,
      env.razorpay.webhookSecret,
    );
  }
  return new DevPaymentGateway();
}

export function initialPaymentStatus(method: PaymentMethod): PaymentStatus {
  return method === PaymentMethod.PAY_ON_SERVICE ? PaymentStatus.PAY_ON_SERVICE : PaymentStatus.PENDING;
}
