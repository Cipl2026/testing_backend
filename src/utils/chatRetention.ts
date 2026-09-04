/** Chat messages are automatically removed after this period across the platform. */
export const CHAT_MESSAGE_RETENTION_DAYS = 3;

export const CHAT_MESSAGE_RETENTION_MS = CHAT_MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export function getChatRetentionCutoffDate(now = Date.now()): Date {
  return new Date(now - CHAT_MESSAGE_RETENTION_MS);
}

export function isWithinChatRetention(createdAt: Date | string, now = Date.now()): boolean {
  const timestamp = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
  if (Number.isNaN(timestamp)) return false;
  return timestamp >= now - CHAT_MESSAGE_RETENTION_MS;
}

export function filterMessagesByRetention<T extends { createdAt: Date | string }>(
  messages: T[],
  now = Date.now(),
): T[] {
  return messages.filter((message) => isWithinChatRetention(message.createdAt, now));
}
