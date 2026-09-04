import crypto from 'node:crypto';
import { timingSafeEqual } from 'node:crypto';
import {
  ConnectedDeviceStatus,
  IoTEventSeverity,
  IoTEventStatus,
  QueueName,
} from '@ghaarfix/shared-types';
import { ConnectedDevice, IoTEvent, IoTIntegrationConnection, IoTIntegrationHealth } from '@/models/IoT.js';
import { getIoTProvider } from '@/modules/iot/providers/iot-provider.factory.js';
import { enqueueJob, isQueueEnabled } from '@/infra/queue.service.js';
import { processIoTEvent } from '@/modules/iot/event-processor.service.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

const REPLAY_WINDOW_MS = 5 * 60 * 1000;
const MAX_PAYLOAD_BYTES = 64 * 1024;

export function verifyWebhookSignature(input: {
  secret: string;
  signature: string;
  timestamp: string;
  rawBody: string;
}) {
  const ts = Number(input.timestamp);
  if (!ts || Math.abs(Date.now() - ts) > REPLAY_WINDOW_MS) {
    throw new AppError('Webhook timestamp invalid or expired.', 401, ErrorCode.UNAUTHORIZED);
  }

  const expected = crypto
    .createHmac('sha256', input.secret)
    .update(`${input.timestamp}.${input.rawBody}`)
    .digest('hex');

  const sig = input.signature.replace(/^sha256=/, '');
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AppError('Invalid webhook signature.', 401, ErrorCode.UNAUTHORIZED);
  }
}

export async function ingestWebhookEvent(input: {
  connectionId: string;
  payload: Record<string, unknown>;
  rawBody: string;
  signature?: string;
  timestamp?: string;
}) {
  if (input.rawBody.length > MAX_PAYLOAD_BYTES) {
    throw new AppError('Payload too large.', 413, ErrorCode.VALIDATION_ERROR);
  }

  const start = Date.now();
  const connection = await IoTIntegrationConnection.findById(input.connectionId);
  if (!connection || !connection.webhookSecret) {
    await recordIntegrationFailure(connection?.provider, connection?._id.toString(), 'Connection not found');
    throw new AppError('Connection not found.', 404, ErrorCode.NOT_FOUND);
  }

  if (input.signature && input.timestamp) {
    verifyWebhookSignature({
      secret: connection.webhookSecret,
      signature: input.signature,
      timestamp: input.timestamp,
      rawBody: input.rawBody,
    });
  }

  const provider = getIoTProvider(connection.provider);
  const normalized = provider.normalizeEvent(input.payload, {
    connectionId: connection._id.toString(),
    provider: connection.provider,
  });

  const device = await ConnectedDevice.findOne({
    provider: connection.provider,
    externalDeviceId: normalized.deviceExternalId,
    status: { $ne: ConnectedDeviceStatus.REMOVED },
  });

  if (!device) {
    throw new AppError('Device not registered.', 404, ErrorCode.NOT_FOUND);
  }

  const existing = await IoTEvent.findOne({ dedupeKey: normalized.dedupeKey });
  if (existing) {
    return { eventId: existing._id.toString(), duplicate: true };
  }

  const event = await IoTEvent.create({
    deviceId: device._id,
    homeId: device.homeId,
    eventType: normalized.eventType,
    severity: normalized.severity,
    payload: normalized.payload,
    occurredAt: normalized.occurredAt,
    receivedAt: new Date(),
    dedupeKey: normalized.dedupeKey,
    status: IoTEventStatus.NEW,
  });

  device.lastSeenAt = new Date();
  device.status = ConnectedDeviceStatus.ONLINE;
  await device.save();

  const latency = Date.now() - start;
  await recordIntegrationSuccess(connection.provider, connection._id.toString(), latency);

  const priority = normalized.severity === IoTEventSeverity.CRITICAL ? 1 : 5;
  if (isQueueEnabled()) {
    await enqueueJob(
      QueueName.IOT_EVENTS,
      'process-iot-event',
      { eventId: event._id.toString() },
      { priority },
    );
  } else {
    await processIoTEvent(event._id.toString());
  }

  return { eventId: event._id.toString(), duplicate: false };
}

async function recordIntegrationSuccess(
  provider: import('@ghaarfix/shared-types').IoTProviderType,
  connectionId: string,
  latencyMs: number,
) {
  await IoTIntegrationHealth.findOneAndUpdate(
    { provider, connectionId },
    {
      $set: { lastSuccessAt: new Date(), lastError: undefined },
      $inc: { avgLatencyMs: latencyMs },
    },
    { upsert: true },
  );
}

async function recordIntegrationFailure(
  provider?: import('@ghaarfix/shared-types').IoTProviderType,
  connectionId?: string,
  error?: string,
) {
  if (!provider) return;
  await IoTIntegrationHealth.findOneAndUpdate(
    { provider, connectionId },
    {
      $set: { lastFailureAt: new Date(), lastError: error },
      $inc: { webhookFailures: 1 },
    },
    { upsert: true },
  );
}
