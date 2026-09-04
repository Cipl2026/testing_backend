import {
  AnalyticsEventName,
  AssistantMessageRole,
  ErrorCode,
  IntelligenceFeature,
  IntelligenceFeedbackType,
} from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import {
  AssistantConversation,
  AssistantMessage,
  IntelligenceFeedback,
} from '@/models/Intelligence.js';
import { Subscription } from '@/models/Subscription.js';
import { getAIProvider } from '@/modules/intelligence/ai-provider/ai-provider.factory.js';
import {
  assertAnalysisOwnership,
  assertCostLimit,
  assertIntelligenceFeatureEnabled,
  recordUsage,
} from '@/modules/intelligence/intelligence-usage.service.js';
import { trackEvent } from '@/modules/discovery-growth/analytics.service.js';
import { AppError } from '@/utils/AppError.js';
import { getChatRetentionCutoffDate } from '@/utils/chatRetention.js';

const HANDOFF_KEYWORDS = ['human', 'agent', 'support', 'complaint', 'angry', 'frustrated'];

export async function sendAssistantMessage(
  customerId: string,
  input: { message: string; conversationId?: string },
) {
  await assertIntelligenceFeatureEnabled(IntelligenceFeature.SUPPORT_ASSISTANT, customerId);
  await assertCostLimit(IntelligenceFeature.SUPPORT_ASSISTANT, customerId);

  const lower = input.message.toLowerCase();
  const needsHandoff = HANDOFF_KEYWORDS.some((kw) => lower.includes(kw));

  let conversation = input.conversationId
    ? await AssistantConversation.findOne({ _id: input.conversationId, customerId })
    : null;

  if (!conversation) {
    conversation = await AssistantConversation.create({
      customerId,
      title: input.message.slice(0, 60),
      lastMessageAt: new Date(),
    });
  }

  await AssistantMessage.create({
    conversationId: conversation._id,
    role: AssistantMessageRole.USER,
    content: input.message,
  });

  if (needsHandoff) {
    conversation.handoffRequested = true;
    await conversation.save();
    const handoffReply =
      'I understand you would like to speak with our support team. I can create a support ticket for you, or you can reach us through the Support section in the app.';
    await AssistantMessage.create({
      conversationId: conversation._id,
      role: AssistantMessageRole.ASSISTANT,
      content: handoffReply,
      metadata: { handoff: true },
    });
    await trackEvent({
      eventName: AnalyticsEventName.ASSISTANT_HANDOFF,
      customerId,
    });
    return {
      conversationId: conversation._id.toString(),
      reply: handoffReply,
      handoffRecommended: true,
    };
  }

  const bookingContext = await getAuthorizedBookingContext(customerId, lower);
  const subscriptionContext = await getSubscriptionContext(customerId, lower);

  const retentionCutoff = getChatRetentionCutoffDate();
  const history = await AssistantMessage.find({
    conversationId: conversation._id,
    createdAt: { $gte: retentionCutoff },
  })
    .sort({ createdAt: 1 })
    .limit(20)
    .lean();

  const provider = getAIProvider();
  const start = Date.now();
  const messages = [
    {
      role: 'system',
      content:
        'You are the GhaarFix assistant for home services in India. Help with services, bookings, invoices, care plans, and maintenance. Never make up booking data. Do not answer questions unrelated to home services or the GhaarFix app — politely redirect off-topic questions.',
    },
    ...(bookingContext
      ? [{ role: 'system', content: `Authorized booking context: ${bookingContext}` }]
      : []),
    ...(subscriptionContext
      ? [{ role: 'system', content: `Authorized subscription context: ${subscriptionContext}` }]
      : []),
    ...history.map((entry) => ({
      role: entry.role === AssistantMessageRole.USER ? 'user' : 'assistant',
      content: entry.content,
    })),
  ];

  const reply = await provider.chat(messages);
  const latencyMs = Date.now() - start;
  await recordUsage(IntelligenceFeature.SUPPORT_ASSISTANT, customerId, latencyMs);

  let pendingAction: Record<string, unknown> | undefined;
  if (lower.includes('cancel') && bookingContext) {
    pendingAction = { type: 'CANCEL_BOOKING', requiresConfirmation: true };
  }

  await AssistantMessage.create({
    conversationId: conversation._id,
    role: AssistantMessageRole.ASSISTANT,
    content: reply,
    pendingAction,
  });

  conversation.lastMessageAt = new Date();
  await conversation.save();

  await trackEvent({
    eventName: AnalyticsEventName.ASSISTANT_MESSAGE_SENT,
    customerId,
  });

  return {
    conversationId: conversation._id.toString(),
    reply,
    handoffRecommended: false,
    pendingAction,
  };
}

async function getAuthorizedBookingContext(customerId: string, message: string) {
  if (!message.includes('booking') && !message.includes('electrician') && !message.includes('status')) {
    return null;
  }
  const booking = await Booking.findOne({ customerId }).sort({ createdAt: -1 });
  if (!booking) return null;
  return `Booking ${booking.bookingNumber}, status: ${booking.status}, scheduled: ${booking.scheduledStart.toISOString()}`;
}

async function getSubscriptionContext(customerId: string, message: string) {
  if (!message.includes('care') && !message.includes('subscription') && !message.includes('plan')) {
    return null;
  }
  const sub = await Subscription.findOne({ customerId, status: 'ACTIVE' });
  if (!sub) return 'No active Care Plan subscription.';
  return `Active subscription plan ID: ${sub.planId.toString()}`;
}

export async function listConversations(customerId: string) {
  const retentionCutoff = getChatRetentionCutoffDate();
  const items = await AssistantConversation.find({
    customerId,
    lastMessageAt: { $gte: retentionCutoff },
  })
    .sort({ lastMessageAt: -1 })
    .limit(20);
  return items.map((c) => ({
    id: c._id.toString(),
    title: c.title,
    lastMessageAt: c.lastMessageAt,
    handoffRequested: c.handoffRequested,
  }));
}

export async function confirmAssistantAction(
  customerId: string,
  input: { conversationId: string; actionType: string; confirmed: boolean; bookingId?: string },
) {
  if (!input.confirmed) {
    return { status: 'CANCELLED', message: 'Action cancelled.' };
  }

  if (input.actionType === 'CANCEL_BOOKING' && input.bookingId) {
    const booking = await Booking.findOne({ _id: input.bookingId, customerId });
    if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);
    return {
      status: 'REQUIRES_APP_FLOW',
      message: 'Please complete cancellation in the booking details screen for confirmation.',
      bookingId: booking._id.toString(),
    };
  }

  return { status: 'UNSUPPORTED', message: 'This action is not supported via assistant.' };
}

export async function submitFeedback(
  customerId: string,
  input: {
    analysisId: string;
    feature: IntelligenceFeature;
    userFeedback: IntelligenceFeedbackType;
    wasCorrect?: boolean;
    correctedValue?: string;
  },
) {
  await assertAnalysisOwnership(input.analysisId, customerId);

  const feedback = await IntelligenceFeedback.create({
    analysisId: input.analysisId,
    feature: input.feature,
    customerId,
    userFeedback: input.userFeedback,
    wasCorrect: input.wasCorrect,
    correctedValue: input.correctedValue,
  });

  await trackEvent({
    eventName: AnalyticsEventName.AI_FEEDBACK_SUBMITTED,
    customerId,
    properties: { feature: input.feature, feedback: input.userFeedback },
  });

  return { id: feedback._id.toString() };
}

export async function submitProviderDiagnosisFeedback(
  providerId: string,
  input: {
    analysisId: string;
    wasCorrect: boolean;
    correctedCategory?: string;
    actualDiagnosis?: string;
  },
) {
  const feedback = await IntelligenceFeedback.create({
    analysisId: input.analysisId,
    feature: IntelligenceFeature.ISSUE_CLASSIFICATION,
    providerId,
    userFeedback: input.wasCorrect
      ? IntelligenceFeedbackType.HELPFUL
      : IntelligenceFeedbackType.INCORRECT,
    wasCorrect: input.wasCorrect,
    correctedValue: input.correctedCategory ?? input.actualDiagnosis,
  });
  return { id: feedback._id.toString() };
}
