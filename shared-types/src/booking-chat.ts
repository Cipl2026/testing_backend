export enum BookingMessageAuthorRole {
  CUSTOMER = 'CUSTOMER',
  PROVIDER = 'PROVIDER',
  SYSTEM = 'SYSTEM',
}

export interface BookingChatMessage {
  id: string;
  bookingId: string;
  authorId?: string;
  authorRole: BookingMessageAuthorRole;
  body: string;
  createdAt: string;
  deletedAt?: string | null;
}
