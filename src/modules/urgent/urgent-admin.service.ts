import { UrgentDispatchTarget } from '@/models/UrgentDispatchTarget.js';
import { UrgentRequest } from '@/models/UrgentRequest.js';
import { Service } from '@/models/Service.js';
import { ProviderProfile } from '@/models/ProviderProfile.js';
import { buildPaginationMeta } from '@/utils/catalog.js';
import { serializeUrgentRequestDetail, serializeUrgentRequestSummary } from '@/utils/urgentSerializers.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode, UrgentDispatchTargetStatus, UrgentRequestStatus } from '@ghaarfix/shared-types';
import { emitUrgentRequestClosed, emitUrgentCancelled } from '@/modules/realtime/socket.service.js';
import { AdminAuditLog } from '@/models/AdminAuditLog.js';

export async function adminListUrgentRequests(query: {
  page: number;
  limit: number;
  status?: string;
  search?: string;
}) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.search) {
    filter.$or = [
      { requestNumber: { $regex: query.search, $options: 'i' } },
    ];
  }

  const total = await UrgentRequest.countDocuments(filter);
  const items = await UrgentRequest.find(filter)
    .sort({ createdAt: -1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);

  const enriched = await Promise.all(
    items.map(async (request) => {
      const [service, profile, broadcastCount] = await Promise.all([
        Service.findById(request.serviceId).select('name'),
        request.providerId
          ? ProviderProfile.findOne({ userId: request.providerId }).select('fullName')
          : null,
        UrgentDispatchTarget.countDocuments({ urgentRequestId: request._id }),
      ]);
      return {
        ...serializeUrgentRequestDetail(request, {
          serviceName: service?.name,
          providerName: profile?.fullName,
        }),
        broadcastCount,
        responseTimeMs:
          request.acceptedAt && request.createdAt
            ? request.acceptedAt.getTime() - request.createdAt.getTime()
            : null,
      };
    }),
  );

  return { items: enriched, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function adminGetUrgentRequest(requestId: string) {
  const request = await UrgentRequest.findById(requestId);
  if (!request) throw new AppError('Urgent request not found.', 404, ErrorCode.NOT_FOUND);
  const [service, profile, targets] = await Promise.all([
    Service.findById(request.serviceId).select('name'),
    request.providerId
      ? ProviderProfile.findOne({ userId: request.providerId }).select('fullName')
      : null,
    UrgentDispatchTarget.find({ urgentRequestId: request._id }).sort({ rankScore: -1 }),
  ]);
  return serializeUrgentRequestDetail(request, {
    serviceName: service?.name,
    providerName: profile?.fullName,
    dispatchTargets: targets,
  });
}

export async function adminCancelUrgentRequest(
  adminId: string,
  requestId: string,
  reason: string,
) {
  const before = await UrgentRequest.findById(requestId);
  if (!before) throw new AppError('Urgent request not found.', 404, ErrorCode.NOT_FOUND);
  if (before.status !== UrgentRequestStatus.SEARCHING) {
    throw new AppError('Only searching requests can be cancelled by admin.', 409, ErrorCode.CONFLICT);
  }

  const cancelled = await UrgentRequest.findOneAndUpdate(
    { _id: requestId, status: UrgentRequestStatus.SEARCHING },
    {
      $set: {
        status: UrgentRequestStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellation: { reason, actorId: adminId, actorRole: 'ADMIN' },
      },
    },
    { new: true },
  );
  if (!cancelled) {
    throw new AppError('Urgent request could not be cancelled.', 409, ErrorCode.CONFLICT);
  }

  await UrgentDispatchTarget.updateMany(
    { urgentRequestId: cancelled._id },
    { status: UrgentDispatchTargetStatus.EXPIRED, respondedAt: new Date() },
  );
  const targets = await UrgentDispatchTarget.find({ urgentRequestId: cancelled._id });
  for (const target of targets) {
    emitUrgentRequestClosed(target.providerId.toString(), {
      urgentRequestId: cancelled._id.toString(),
      reason: 'admin-cancelled',
    });
  }
  emitUrgentCancelled(cancelled.customerId.toString(), serializeUrgentRequestSummary(cancelled));

  await AdminAuditLog.create({
    adminId,
    action: 'URGENT_REQUEST_CANCEL',
    entityType: 'UrgentRequest',
    entityId: requestId,
    before: { status: before.status },
    after: { status: UrgentRequestStatus.CANCELLED },
    reason,
  });

  return serializeUrgentRequestSummary(cancelled);
}
