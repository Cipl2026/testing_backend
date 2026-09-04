import { AssistantConversation, AssistantMessage } from '@/models/Intelligence.js';
import { SupportTicket } from '@/models/SupportTicket.js';
import { getChatRetentionCutoffDate } from '@/utils/chatRetention.js';

export async function purgeExpiredSupportTicketMessages(): Promise<number> {
  const cutoff = getChatRetentionCutoffDate();
  const result = await SupportTicket.updateMany(
    { 'messages.createdAt': { $lt: cutoff } },
    { $pull: { messages: { createdAt: { $lt: cutoff } } } },
  );
  return result.modifiedCount ?? 0;
}

export async function purgeExpiredAssistantMessages(): Promise<number> {
  const cutoff = getChatRetentionCutoffDate();

  const messageResult = await AssistantMessage.deleteMany({ createdAt: { $lt: cutoff } });
  const conversationResult = await AssistantConversation.deleteMany({
    lastMessageAt: { $lt: cutoff },
  });

  return (messageResult.deletedCount ?? 0) + (conversationResult.deletedCount ?? 0);
}

export async function purgeExpiredChatMessages(): Promise<{
  supportTickets: number;
  assistant: number;
}> {
  const [supportTickets, assistant] = await Promise.all([
    purgeExpiredSupportTicketMessages(),
    purgeExpiredAssistantMessages(),
  ]);
  return { supportTickets, assistant };
}
