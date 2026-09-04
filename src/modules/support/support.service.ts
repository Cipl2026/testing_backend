import { Types } from 'mongoose';
import {
  ErrorCode,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
  TimelineEventType,
  UserRole,
} from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { SupportTicket } from '@/models/SupportTicket.js';
import { AdminAuditLog } from '@/models/AdminAuditLog.js';
import { addTimelineEvent } from '@/modules/bookings/timeline.service.js';
import { createNotification, notifyBookingEvent } from '@/modules/notifications/notification.service.js';
import { emitSupportMessage } from '@/modules/realtime/socket.service.js';
import { buildPaginationMeta } from '@/utils/catalog.js';
import { generateTicketNumber } from '@/utils/invoiceNumber.js';
import { AppError } from '@/utils/AppError.js';
import { filterMessagesByRetention } from '@/utils/chatRetention.js';

function priorityForCategory(category: SupportTicketCategory): SupportTicketPriority {
  if (category === SupportTicketCategory.SAFETY_CONCERN) return SupportTicketPriority.URGENT;
  if (
    category === SupportTicketCategory.PAYMENT_ISSUE ||
    category === SupportTicketCategory.SERVICE_NOT_COMPLETED
  ) {
    return SupportTicketPriority.HIGH;
  }
  return SupportTicketPriority.NORMAL;
}

export async function createSupportTicket(
  customerId: string,
  bookingId: string,
  input: {
    category: SupportTicketCategory;
    subject: string;
    description: string;
    attachments?: string[];
  },
) {
  const booking = await Booking.findOne({ _id: bookingId, customerId });
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);

  const ticket = await SupportTicket.create({
    ticketNumber: generateTicketNumber(),
    bookingId,
    customerId,
    providerId: booking.providerId,
    category: input.category,
    priority: priorityForCategory(input.category),
    subject: input.subject,
    description: input.description,
    attachments: input.attachments ?? [],
    status: SupportTicketStatus.OPEN,
    messages: [
      {
        authorId: booking.customerId,
        authorRole: UserRole.CUSTOMER,
        body: input.description,
        isInternal: false,
        createdAt: new Date(),
      },
    ],
  });

  await addTimelineEvent({
    bookingId,
    type: TimelineEventType.SUPPORT_TICKET_CREATED,
    actorId: customerId,
    actorRole: UserRole.CUSTOMER,
    metadata: { ticketId: ticket._id.toString(), category: input.category },
  });

  await notifyBookingEvent(
    customerId,
    'SUPPORT_TICKET_CREATED',
    'Support ticket created',
    'We received your support request.',
    bookingId,
  );

  return serializeTicket(ticket);
}

const GENERAL_SUPPORT_SUBJECT = 'GhaarFix Support Chat';
const OPEN_TICKET_STATUSES = [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS];

export async function getOrCreateGeneralSupportTicket(customerId: string) {
  const existing = await SupportTicket.findOne({
    customerId,
    $or: [{ bookingId: null }, { bookingId: { $exists: false } }],
    status: { $in: OPEN_TICKET_STATUSES },
  }).sort({ updatedAt: -1 });

  if (existing) return serializeTicketDetail(existing);

  const ticket = await SupportTicket.create({
    ticketNumber: generateTicketNumber(),
    customerId,
    category: SupportTicketCategory.OTHER,
    priority: SupportTicketPriority.NORMAL,
    subject: GENERAL_SUPPORT_SUBJECT,
    description: 'Customer initiated support chat',
    attachments: [],
    status: SupportTicketStatus.OPEN,
    messages: [],
  });

  await createNotification({
    userId: customerId,
    type: 'SUPPORT_TICKET_CREATED',
    title: 'Support chat started',
    body: 'Our team can help you here. Send a message anytime.',
    data: { ticketId: ticket._id.toString() },
  });

  return serializeTicketDetail(ticket);
}

export async function createGeneralSupportTicket(
  customerId: string,
  input: {
    category?: SupportTicketCategory;
    subject?: string;
    description: string;
  },
) {
  const category = input.category ?? SupportTicketCategory.OTHER;
  const ticket = await SupportTicket.create({
    ticketNumber: generateTicketNumber(),
    customerId,
    category,
    priority: priorityForCategory(category),
    subject: input.subject ?? 'Support request',
    description: input.description,
    attachments: [],
    status: SupportTicketStatus.OPEN,
    messages: [
      {
        authorId: new Types.ObjectId(customerId),
        authorRole: UserRole.CUSTOMER,
        body: input.description,
        isInternal: false,
        createdAt: new Date(),
      },
    ],
  });

  await createNotification({
    userId: customerId,
    type: 'SUPPORT_TICKET_CREATED',
    title: 'Report submitted',
    body: 'We received your message and will respond shortly.',
    data: { ticketId: ticket._id.toString(), category },
  });

  return serializeTicketDetail(ticket);
}

export async function addCustomerMessage(customerId: string, ticketId: string, body: string) {
  const ticket = await SupportTicket.findOne({ _id: ticketId, customerId });
  if (!ticket) throw new AppError('Ticket not found.', 404, ErrorCode.NOT_FOUND);
  if (ticket.status === SupportTicketStatus.CLOSED || ticket.status === SupportTicketStatus.RESOLVED) {
    throw new AppError('This ticket is closed. Open a new support request.', 400, ErrorCode.VALIDATION_ERROR);
  }

  ticket.messages.push({
    authorId: new Types.ObjectId(customerId),
    authorRole: UserRole.CUSTOMER,
    body,
    isInternal: false,
    createdAt: new Date(),
  });
  if (ticket.status === SupportTicketStatus.OPEN) {
    ticket.status = SupportTicketStatus.IN_PROGRESS;
  }
  await ticket.save();

  if (ticket.bookingId) {
    await notifyBookingEvent(
      customerId,
      'SUPPORT_MESSAGE',
      'Message sent',
      'Your support message was delivered.',
      ticket.bookingId.toString(),
    );
  }

  return serializeTicketDetail(ticket);
}

export async function listCustomerTickets(customerId: string, query: { page: number; limit: number }) {
  const filter = { customerId };
  const total = await SupportTicket.countDocuments(filter);
  const items = await SupportTicket.find(filter)
    .sort({ createdAt: -1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);
  return { items: items.map(serializeTicket), meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function getCustomerTicket(customerId: string, ticketId: string) {
  const ticket = await SupportTicket.findOne({ _id: ticketId, customerId });
  if (!ticket) throw new AppError('Ticket not found.', 404, ErrorCode.NOT_FOUND);
  return serializeTicketDetail(ticket);
}

export async function listAdminTickets(query: {
  page: number;
  limit: number;
  status?: string;
  category?: string;
  priority?: string;
}) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.category) filter.category = query.category;
  if (query.priority) filter.priority = query.priority;

  const total = await SupportTicket.countDocuments(filter);
  const items = await SupportTicket.find(filter)
    .sort({ createdAt: -1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);
  return { items: items.map(serializeTicket), total };
}

export async function getAdminTicket(ticketId: string) {
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw new AppError('Ticket not found.', 404, ErrorCode.NOT_FOUND);
  return serializeTicketDetail(ticket, true);
}

export async function updateAdminTicket(
  adminId: string,
  ticketId: string,
  input: {
    status?: SupportTicketStatus;
    resolution?: string;
    internalNote?: string;
    reply?: string;
    reason: string;
  },
) {
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw new AppError('Ticket not found.', 404, ErrorCode.NOT_FOUND);

  const before = { status: ticket.status, resolution: ticket.resolution };
  if (input.status) ticket.status = input.status;
  if (input.resolution) ticket.resolution = input.resolution;
  if (input.reply) {
    ticket.messages.push({
      authorId: new Types.ObjectId(adminId),
      authorRole: UserRole.ADMIN,
      body: input.reply,
      isInternal: false,
      createdAt: new Date(),
    });
  }
  if (input.internalNote) {
    ticket.messages.push({
      authorId: new Types.ObjectId(adminId),
      authorRole: UserRole.ADMIN,
      body: input.internalNote,
      isInternal: true,
      createdAt: new Date(),
    });
  }
  await ticket.save();

  await AdminAuditLog.create({
    adminId,
    action: 'SUPPORT_TICKET_UPDATE',
    entityType: 'SupportTicket',
    entityId: ticket._id,
    reason: input.reason,
    before,
    after: { status: ticket.status, resolution: ticket.resolution },
  });

  if (input.reply) {
    await createNotification({
      userId: ticket.customerId.toString(),
      type: 'SUPPORT_MESSAGE',
      title: 'Support reply',
      body: 'You have a new message from our support team.',
      data: { ticketId: ticket._id.toString() },
    });
    emitSupportMessage(ticket.customerId.toString(), { ticketId: ticket._id.toString() });
  } else if (ticket.bookingId) {
    await notifyBookingEvent(
      ticket.customerId.toString(),
      'SUPPORT_TICKET_UPDATED',
      'Support ticket updated',
      `Your ticket status: ${ticket.status}`,
      ticket.bookingId.toString(),
    );
  } else {
    await createNotification({
      userId: ticket.customerId.toString(),
      type: 'SUPPORT_TICKET_UPDATED',
      title: 'Support ticket updated',
      body: `Your ticket status: ${ticket.status}`,
      data: { ticketId: ticket._id.toString() },
    });
  }

  return serializeTicketDetail(ticket, true);
}

function serializeTicket(doc: InstanceType<typeof SupportTicket>) {
  return {
    id: doc._id.toString(),
    ticketNumber: doc.ticketNumber,
    bookingId: doc.bookingId?.toString() ?? null,
    category: doc.category,
    priority: doc.priority,
    subject: doc.subject,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function serializeTicketDetail(doc: InstanceType<typeof SupportTicket>, includeInternal = false) {
  const cutoffMessages = includeInternal
    ? doc.messages
    : doc.messages.filter((m) => !m.isInternal);

  const messages = filterMessagesByRetention(cutoffMessages);

  return {
    ...serializeTicket(doc),
    description: doc.description,
    attachments: doc.attachments,
    resolution: doc.resolution,
    messages: messages.map((m) => ({
      authorRole: m.authorRole,
      body: m.body,
      isInternal: m.isInternal,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}
