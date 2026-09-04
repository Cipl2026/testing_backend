import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { StepUpMethod, StepUpStatus } from '@ghaarfix/shared-types';
import { StepUpAuthentication } from '@/models/Security.js';
import { User } from '@/models/User.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';
import { logSecurityAudit } from '@/modules/security/security-audit.service.js';
import { recordSecurityEvent } from '@/modules/security/security-event.service.js';
import { SecurityEventSeverity, SecurityEventType } from '@ghaarfix/shared-types';

const STEP_UP_TTL_MS = 10 * 60 * 1000;

export async function initiateStepUp(
  userId: string,
  action: string,
  method: StepUpMethod = StepUpMethod.OTP,
): Promise<{ stepUpId: string; method: StepUpMethod }> {
  const stepUp = await StepUpAuthentication.create({
    userId,
    action,
    method,
    status: StepUpStatus.PENDING,
    expiresAt: new Date(Date.now() + STEP_UP_TTL_MS),
  });

  await recordSecurityEvent({
    type: SecurityEventType.STEP_UP_REQUIRED,
    severity: SecurityEventSeverity.MEDIUM,
    actorId: userId,
    metadata: { action, method },
  });

  return { stepUpId: stepUp._id.toString(), method };
}

export async function verifyStepUpMpin(
  userId: string,
  stepUpId: string,
  mpin: string,
): Promise<boolean> {
  const stepUp = await StepUpAuthentication.findOne({
    _id: stepUpId,
    userId,
    status: StepUpStatus.PENDING,
    expiresAt: { $gt: new Date() },
  });
  if (!stepUp) {
    throw new AppError('Step-up verification expired or not found.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const user = await User.findById(userId).select('+passwordHash');
  if (!user?.passwordHash) {
    throw new AppError('Account not configured for MPIN verification.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const valid = await bcrypt.compare(mpin, user.passwordHash);
  if (!valid) {
    stepUp.status = StepUpStatus.FAILED;
    await stepUp.save();
    return false;
  }

  stepUp.status = StepUpStatus.VERIFIED;
  stepUp.verifiedAt = new Date();
  await stepUp.save();

  await logSecurityAudit({
    actorId: userId,
    actorType: user.role,
    action: 'step_up.verified',
    targetType: 'step_up',
    targetId: stepUpId,
    metadata: { action: stepUp.action },
  });

  await recordSecurityEvent({
    type: SecurityEventType.STEP_UP_COMPLETED,
    severity: SecurityEventSeverity.LOW,
    actorId: userId,
    metadata: { action: stepUp.action },
  });

  return true;
}

export async function assertStepUpVerified(userId: string, action: string): Promise<void> {
  const recent = await StepUpAuthentication.findOne({
    userId,
    action,
    status: StepUpStatus.VERIFIED,
    verifiedAt: { $gte: new Date(Date.now() - STEP_UP_TTL_MS) },
  }).sort({ verifiedAt: -1 });

  if (!recent) {
    throw new AppError(
      'Step-up authentication required for this action.',
      403,
      ErrorCode.FORBIDDEN,
    );
  }
}

export function generateStepUpToken(): string {
  return randomBytes(24).toString('hex');
}
