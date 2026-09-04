import {
  ErrorCode,
  MarketplaceOrderStatus,
  OrderFulfillmentStatus,
  PaymentMethod,
  PaymentStatus,
} from '@ghaarfix/shared-types';
import {
  MarketplaceCart,
  MarketplaceOrder,
  MarketplacePayment,
  OrderFulfillment,
  OrderItem,
  Product,
  ProductVariant,
} from '@/models/Marketplace.js';
import { CustomerAddress } from '@/models/CustomerAddress.js';
import { calculateMarketplacePrice } from '@/modules/marketplace/marketplace-pricing.service.js';
import {
  confirmReservation,
  releaseReservation,
  reserveInventory,
} from '@/modules/marketplace/inventory.service.js';
import { createWarrantiesForOrder } from '@/modules/marketplace/warranty.service.js';
import { getPaymentGateway } from '@/modules/payments/payment-gateway.js';
import { clearCart } from '@/modules/marketplace/cart.service.js';
import { AppError } from '@/utils/AppError.js';

function generateOrderNumber() {
  return `MK${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function createOrder(
  customerId: string,
  input: {
    addressId: string;
    paymentMethod: PaymentMethod;
    idempotencyKey?: string;
    assetId?: string;
  },
) {
  if (input.idempotencyKey) {
    const existing = await MarketplaceOrder.findOne({ idempotencyKey: input.idempotencyKey });
    if (existing) return serializeOrder(existing);
  }

  const address = await CustomerAddress.findOne({ _id: input.addressId, customerId });
  if (!address) throw new AppError('Address not found.', 404, ErrorCode.NOT_FOUND);

  const cart = await MarketplaceCart.findOne({ customerId });
  if (!cart?.items.length) throw new AppError('Cart is empty.', 400, ErrorCode.VALIDATION_ERROR);

  const lineItems = await Promise.all(
    cart.items.map(async (item) => {
      const variant = await ProductVariant.findById(item.variantId);
      if (!variant) throw new AppError('Invalid cart item.', 400, ErrorCode.VALIDATION_ERROR);
      return {
        variant,
        product: await Product.findById(variant.productId),
        partnerId: item.partnerId.toString(),
        quantity: item.quantity,
        includeInstallation: item.includeInstallation,
      };
    }),
  );

  const reservations = [];
  try {
    for (const line of lineItems) {
      const r = await reserveInventory({
        customerId,
        variantId: line.variant._id.toString(),
        partnerId: line.partnerId,
        quantity: line.quantity,
        serviceZoneId: cart.serviceZoneId?.toString(),
      });
      reservations.push(r);
    }
  } catch (error) {
    for (const r of reservations) {
      await releaseReservation(r._id.toString());
    }
    throw error;
  }

  const pricing = await calculateMarketplacePrice({
    items: lineItems.map((l) => ({
      variantId: l.variant._id.toString(),
      partnerId: l.partnerId,
      quantity: l.quantity,
      unitPrice: l.variant.price,
    })),
    installationFee: lineItems.some((l) => l.includeInstallation) ? 299 : 0,
  });

  const order = await MarketplaceOrder.create({
    orderNumber: generateOrderNumber(),
    customerId,
    addressId: input.addressId,
    serviceZoneId: cart.serviceZoneId,
    status: MarketplaceOrderStatus.PENDING,
    paymentStatus:
      input.paymentMethod === PaymentMethod.PAY_ON_SERVICE
        ? PaymentStatus.PAY_ON_SERVICE
        : PaymentStatus.PENDING,
    pricingSnapshot: pricing,
    idempotencyKey: input.idempotencyKey,
  });

  const partnerIds = new Set<string>();

  for (let i = 0; i < lineItems.length; i++) {
    const line = lineItems[i]!;
    const commission = pricing.commissionSnapshots.find((c) => c.partnerId === line.partnerId);
    await OrderItem.create({
      orderId: order._id,
      variantId: line.variant._id,
      partnerId: line.partnerId,
      quantity: line.quantity,
      unitPrice: line.variant.price,
      totalPrice: line.variant.price * line.quantity,
      productSnapshot: {
        productName: line.product?.name,
        variantName: line.variant.name,
        sku: line.variant.sku,
      },
      warrantySnapshot: line.product?.warrantyConfig,
      commissionSnapshot: commission,
      fulfillmentStatus: OrderFulfillmentStatus.PENDING,
    });
    partnerIds.add(line.partnerId);
    if (reservations[i]) {
      await confirmReservation(reservations[i]._id.toString(), order._id.toString());
    }
  }

  for (const partnerId of partnerIds) {
    await OrderFulfillment.create({
      orderId: order._id,
      partnerId,
      status: OrderFulfillmentStatus.PENDING,
    });
  }

  if (input.paymentMethod === PaymentMethod.ONLINE) {
    const payment = await MarketplacePayment.create({
      orderId: order._id,
      customerId,
      amount: pricing.finalAmount,
      currency: pricing.currency,
      status: PaymentStatus.PENDING,
      metadata: { paymentContext: 'MARKETPLACE' },
    });

    const gateway = getPaymentGateway();
    const gatewayResult = await gateway.createPayment({
      amount: pricing.finalAmount,
      currency: pricing.currency,
      bookingId: order._id.toString(),
      customerId,
    });

    payment.providerOrderId = gatewayResult.orderId;
    await payment.save();

    order.paymentId = payment._id;
    order.paymentStatus = PaymentStatus.PENDING;
    await order.save();

    await clearCart(customerId);

    return {
      ...serializeOrder(order),
      payment: {
        paymentId: payment._id.toString(),
        providerOrderId: gatewayResult.orderId,
        amount: pricing.finalAmount,
      },
    };
  }

  order.status = MarketplaceOrderStatus.CONFIRMED;
  order.paymentStatus = PaymentStatus.PAY_ON_SERVICE;
  await order.save();
  await createWarrantiesForOrder(order._id.toString());
  await clearCart(customerId);

  return serializeOrder(order);
}

export async function confirmMarketplacePayment(orderId: string, customerId: string) {
  const order = await MarketplaceOrder.findOne({ _id: orderId, customerId });
  if (!order) throw new AppError('Order not found.', 404, ErrorCode.NOT_FOUND);

  if (order.status === MarketplaceOrderStatus.CONFIRMED) return serializeOrder(order);

  order.status = MarketplaceOrderStatus.CONFIRMED;
  order.paymentStatus = PaymentStatus.PAID;
  await order.save();

  if (order.paymentId) {
    await MarketplacePayment.findByIdAndUpdate(order.paymentId, { status: PaymentStatus.PAID });
  }

  await createWarrantiesForOrder(order._id.toString());
  return serializeOrder(order);
}

export async function listOrders(customerId: string) {
  const orders = await MarketplaceOrder.find({ customerId }).sort({ createdAt: -1 }).limit(50);
  return orders.map(serializeOrder);
}

export async function getOrder(customerId: string, orderId: string) {
  const order = await MarketplaceOrder.findOne({ _id: orderId, customerId });
  if (!order) throw new AppError('Order not found.', 404, ErrorCode.NOT_FOUND);

  const items = await OrderItem.find({ orderId });
  const fulfillments = await OrderFulfillment.find({ orderId });

  return {
    ...serializeOrder(order),
    items: items.map((i) => ({
      id: i._id.toString(),
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      totalPrice: i.totalPrice,
      productSnapshot: i.productSnapshot,
      fulfillmentStatus: i.fulfillmentStatus,
    })),
    fulfillments: fulfillments.map((f) => ({
      partnerId: f.partnerId.toString(),
      status: f.status,
      deliveryStatus: f.deliveryStatus,
    })),
  };
}

function serializeOrder(order: InstanceType<typeof MarketplaceOrder>) {
  return {
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    pricing: order.pricingSnapshot,
    createdAt: order.createdAt,
    installationBookingId: order.installationBookingId?.toString(),
  };
}

export async function handlePaymentFailure(orderId: string) {
  const order = await MarketplaceOrder.findById(orderId);
  if (!order) return;

  const reservations = await import('@/models/Marketplace.js').then((m) =>
    m.InventoryReservation.find({ orderId, status: 'CONFIRMED' }),
  );

  for (const r of reservations) {
    await releaseReservation(r._id.toString());
  }

  order.status = MarketplaceOrderStatus.CANCELLED;
  order.paymentStatus = PaymentStatus.FAILED;
  await order.save();
}
