import { IncidentSeverity, IncidentStatus } from '@ghaarfix/shared-types';
import { Incident, IncidentTimelineEvent, PostmortemAction } from '@/models/Reliability.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

export async function createIncident(input: {
  title: string;
  severity: IncidentSeverity;
  impact?: string;
  affectedServices?: string[];
  ownerId?: string;
}) {
  const incident = await Incident.create({
    title: input.title,
    severity: input.severity,
    status: IncidentStatus.OPEN,
    startedAt: new Date(),
    impact: input.impact,
    affectedServices: input.affectedServices ?? [],
    owner: input.ownerId,
  });

  await IncidentTimelineEvent.create({
    incidentId: incident._id,
    message: 'Incident opened',
    actorId: input.ownerId,
  });

  return formatIncident(incident);
}

export async function updateIncident(
  id: string,
  input: {
    status?: IncidentStatus;
    impact?: string;
    rootCause?: string;
    followUpActions?: string[];
    timelineMessage?: string;
    actorId?: string;
  },
) {
  const incident = await Incident.findById(id);
  if (!incident) throw new AppError('Incident not found', 404, ErrorCode.NOT_FOUND);

  if (input.status) {
    incident.status = input.status;
    if (
      input.status === IncidentStatus.RESOLVED ||
      input.status === IncidentStatus.CLOSED
    ) {
      incident.resolvedAt = new Date();
    }
  }
  if (input.impact !== undefined) incident.impact = input.impact;
  if (input.rootCause !== undefined) incident.rootCause = input.rootCause;
  if (input.followUpActions) incident.followUpActions = input.followUpActions;
  await incident.save();

  if (input.timelineMessage) {
    await IncidentTimelineEvent.create({
      incidentId: incident._id,
      message: input.timelineMessage,
      actorId: input.actorId,
    });
  }

  return formatIncident(incident);
}

export async function listIncidents(status?: IncidentStatus, limit = 50) {
  const query = status ? { status } : {};
  const rows = await Incident.find(query).sort({ startedAt: -1 }).limit(limit);
  return rows.map(formatIncident);
}

export async function getIncidentDetail(id: string) {
  const incident = await Incident.findById(id);
  if (!incident) throw new AppError('Incident not found', 404, ErrorCode.NOT_FOUND);
  const [timeline, actions] = await Promise.all([
    IncidentTimelineEvent.find({ incidentId: incident._id }).sort({ createdAt: 1 }),
    PostmortemAction.find({ incidentId: incident._id }).sort({ createdAt: 1 }),
  ]);
  return {
    ...formatIncident(incident),
    timeline: timeline.map((t) => ({
      id: t._id.toString(),
      message: t.message,
      createdAt: t.createdAt,
    })),
    postmortemActions: actions.map((a) => ({
      id: a._id.toString(),
      action: a.action,
      owner: a.owner,
      dueAt: a.dueAt,
      completedAt: a.completedAt,
    })),
  };
}

function formatIncident(incident: InstanceType<typeof Incident>) {
  return {
    id: incident._id.toString(),
    title: incident.title,
    severity: incident.severity,
    status: incident.status,
    startedAt: incident.startedAt,
    resolvedAt: incident.resolvedAt,
    impact: incident.impact,
    affectedServices: incident.affectedServices,
    rootCause: incident.rootCause,
    followUpActions: incident.followUpActions,
  };
}

export async function countActiveIncidents(): Promise<number> {
  return Incident.countDocuments({
    status: { $in: [IncidentStatus.OPEN, IncidentStatus.INVESTIGATING, IncidentStatus.MITIGATED] },
  });
}
