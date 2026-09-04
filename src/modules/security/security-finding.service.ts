import { SecurityFindingStatus, SecurityFindingSeverity } from '@ghaarfix/shared-types';
import { SecurityFinding } from '@/models/Security.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

export async function listSecurityFindings(status?: SecurityFindingStatus) {
  const query = status ? { status } : {};
  return SecurityFinding.find(query).sort({ discoveredAt: -1 });
}

export async function updateSecurityFinding(
  id: string,
  input: { status?: SecurityFindingStatus; owner?: string },
) {
  const finding = await SecurityFinding.findById(id);
  if (!finding) throw new AppError('Finding not found', 404, ErrorCode.NOT_FOUND);
  if (input.status) {
    finding.status = input.status;
    if (input.status === SecurityFindingStatus.RESOLVED) {
      finding.resolvedAt = new Date();
    }
  }
  if (input.owner) finding.owner = input.owner;
  await finding.save();
  return finding;
}

export async function recordDependencyFinding(input: {
  title: string;
  component: string;
  severity: SecurityFindingSeverity;
  description?: string;
}) {
  return SecurityFinding.create({
    source: 'dependency-scan',
    ...input,
    status: SecurityFindingStatus.OPEN,
    discoveredAt: new Date(),
  });
}

export async function runDependencySecurityCheck(): Promise<number> {
  return SecurityFinding.countDocuments({
    source: 'dependency-scan',
    status: SecurityFindingStatus.OPEN,
  });
}
