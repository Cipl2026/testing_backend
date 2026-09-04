import {
  ErrorCode,
  MarketplaceOrderStatus,
  PaymentStatus,
  ReturnRequestStatus,
} from '@ghaarfix/shared-types';
import {
  MarketplaceOrder,
  MarketplacePayment,
  MarketplaceRefund,
  OrderItem,
  Product,
  ReturnRequest,
} from '@/models/Marketplace.js';
import { getPaymentGateway } from '@/modules/payments/payment-gateway.js';
import { AppError } from '@/utils/AppError.js';

export async function createReturnRequest(
  customerId: string,
  input: {
    orderId: string;
    items: Array<{ orderItemId: string; quantity: number }>;
    reason: string;
    description?: string;
  },
) {
  const order = await MarketplaceOrder.findOne({ _id: input.orderId, customerId });
  if (!order) throw new AppError('Order not found.', 404, ErrorCode.NOT_FOUND);

  if (![MarketplaceOrderStatus.DELIVERED, MarketplaceOrderStatus.CONFIRMED].includes(order.status)) {
    throw new AppError('Order not eligible for return.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const daysSinceOrder = (Date.now() - order.createdAt.getTime()) / (24 * 60 * 60 * 1000);

  for (const item of input.items) {
    const orderItem = await OrderItem.findById(item.orderItemId);
    if (!orderItem || orderItem.orderId.toString() !== order._id.toString()) {
      throw new AppError('Invalid order item.', 400, ErrorCode.VALIDATION_ERROR);
    }
    const product = await Product.findById(
      (orderItem.productSnapshot as { productId?: string }).productId,
    );
    const returnDays = product?.returnPolicyDays ?? 7;
    if (daysSinceOrder > returnDays) {
      throw new AppError(`Return window of ${returnDays} days has passed.`, 400, ErrorCode.VALIDATION_ERROR);
    }
  }

  const existing = await ReturnRequest.findOne({
    orderId: order._id,
    status: { $in: [ReturnRequestStatus.REQUESTED, ReturnRequestStatus.APPROVED] },
  });
  if (existing) throw new AppError('Return already in progress.', 409, ErrorCode.CONFLICT);

  const request = await ReturnRequest.create({
    orderId: order._id,
    customerId,
    items: input.items,
    reason: input.reason,
    description: input.description,
    status: ReturnRequestStatus.REQUESTED,
  });

  order.status = MarketplaceOrderStatus.RETURN_REQUESTED;
  await order.save();

  return { id: request._id.toString(), status: request.status };
}

export async function processRefund(returnRequestId: string, idempotencyKey: string) {
  const existing = await MarketplaceRefund.findOne({ idempotencyKey });
  if (existing) return existing;

  const returnReq = await ReturnRequest.findById(returnRequestId);
  if (!returnReq || returnReq.status !== ReturnRequestStatus.APPROVED) {
    throw new AppError('Return not approved.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const order = await MarketplaceOrder.findById(returnReq.orderId);
  if (!order?.paymentId) throw new AppError('No payment to refund.', 400, ErrorCode.VALIDATION_ERROR);

  const payment = await MarketplacePayment.findById(order.paymentId);
  if (!payment) throw new AppError('Payment not found.', 404, ErrorCode.NOT_FOUND);

  let refundAmount = 0;
  for (const item of returnReq.items) {
    const orderItem = await OrderItem.findById(item.orderItemId);
    if (orderItem) refundAmount += orderItem.unitPrice * item.quantity;
  }

  const gateway = getPaymentGateway();
  if (payment.providerPaymentId) {
    await gateway.refundPayment(payment.providerPaymentId, refundAmount);
  }

  const refund = await MarketplaceRefund.create({
    orderId: order._id,
    returnRequestId: returnReq._id,
    paymentId: payment._id,
    amount: refundAmount,
    status: PaymentStatus.REFUNDED,
    idempotencyKey,
  });

  returnReq.status = ReturnRequestStatus.REFUNDED;
  returnReq.refundPaymentId = payment._id;
  await returnReq.save();

  order.status = MarketplaceOrderStatus.REFUNDED;
  order.paymentStatus = PaymentStatus.REFUNDED;
  await order.save();

  return refund;
}

export async function listReturns(query: { status?: string; limit?: number }) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  const items = await ReturnRequest.find(filter).sort({ createdAt: -1 }).limit(query.limit ?? 50);
  return items.map((r) => ({
    id: r._id.toString(),
    orderId: r.orderId.toString(),
    status: r.status,
    reason: r.reason,
    createdAt: r.createdAt,
  }));
}
