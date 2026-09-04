import type { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer | null = null;

export function setSocketServer(server: SocketIOServer): void {
  io = server;
}

export function getSocketServer(): SocketIOServer | null {
  return io;
}

export function emitToCustomer(customerId: string, event: string, payload: unknown): void {
  io?.to(`customer:${customerId}`).emit(event, payload);
}

export function emitToProvider(providerId: string, event: string, payload: unknown): void {
  io?.to(`provider:${providerId}`).emit(event, payload);
}

export function emitToAdmin(event: string, payload: unknown): void {
  io?.to('admin').emit(event, payload);
}

export function emitUrgentSearching(customerId: string, payload: unknown): void {
  emitToCustomer(customerId, 'urgent:searching', payload);
}

export function emitUrgentSearchProgress(customerId: string, payload: unknown): void {
  emitToCustomer(customerId, 'urgent:search-progress', payload);
}

export function emitUrgentProviderFound(customerId: string, payload: unknown): void {
  emitToCustomer(customerId, 'urgent:provider-found', payload);
}

export function emitUrgentExpired(customerId: string, payload: unknown): void {
  emitToCustomer(customerId, 'urgent:expired', payload);
}

export function emitUrgentCancelled(customerId: string, payload: unknown): void {
  emitToCustomer(customerId, 'urgent:cancelled', payload);
}

export function emitUrgentNewRequest(providerId: string, payload: unknown): void {
  emitToProvider(providerId, 'urgent:new-request', payload);
}

export function emitUrgentRequestClosed(providerId: string, payload: unknown): void {
  emitToProvider(providerId, 'urgent:request-closed', payload);
}

export function emitUrgentAcceptedByOther(providerId: string, payload: unknown): void {
  emitToProvider(providerId, 'urgent:accepted-by-other', payload);
}

export function emitBookingLocationUpdated(customerId: string, payload: unknown): void {
  emitToCustomer(customerId, 'booking:location-updated', payload);
}

export function emitBookingEtaUpdated(customerId: string, payload: unknown): void {
  emitToCustomer(customerId, 'booking:eta-updated', payload);
}

export function emitBookingStatusChanged(customerId: string, payload: unknown): void {
  emitToCustomer(customerId, 'booking:status-changed', payload);
}

export function emitBookingServiceCompleted(customerId: string, payload: unknown): void {
  emitToCustomer(customerId, 'booking:service-completed', payload);
}

export function emitInvoiceReady(customerId: string, payload: unknown): void {
  emitToCustomer(customerId, 'invoice:ready', payload);
}

export function emitNotificationNew(customerId: string, payload: unknown): void {
  emitToCustomer(customerId, 'notification:new', payload);
}

export function emitSupportMessage(customerId: string, payload: unknown): void {
  emitToCustomer(customerId, 'support:message', payload);
}

export function emitAvailabilityChanged(
  providerId: string,
  date: string,
  payload: Record<string, unknown> = {},
): void {
  io?.to(`availability:${providerId}:${date}`).emit('availability:changed', {
    providerId,
    date,
    ...payload,
  });
}

export function emitReviewCreated(providerId: string, payload: unknown): void {
  emitToProvider(providerId, 'review:created', payload);
}
