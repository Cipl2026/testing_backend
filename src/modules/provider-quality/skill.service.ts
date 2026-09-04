import { ErrorCode, ProviderSkillLevel, ProviderSkillStatus } from '@ghaarfix/shared-types';
import { AdminAuditLog } from '@/models/AdminAuditLog.js';
import { ProviderSkill } from '@/models/ProviderSkill.js';
import { Service } from '@/models/Service.js';
import { storeFile } from '@/modules/storage/storage.service.js';
import { AppError } from '@/utils/AppError.js';

function serializeSkill(skill: InstanceType<typeof ProviderSkill>, serviceName?: string) {
  return {
    id: skill._id.toString(),
    skillId: skill.skillId.toString(),
    serviceName,
    level: skill.level,
    status: skill.status,
    verifiedAt: skill.verifiedAt?.toISOString(),
    expiresAt: skill.expiresAt?.toISOString(),
  };
}

export async function listProviderSkills(providerId: string) {
  const skills = await ProviderSkill.find({ providerId }).sort({ createdAt: -1 });
  const items = [];
  for (const skill of skills) {
    const service = await Service.findById(skill.skillId).select('name');
    items.push(serializeSkill(skill, service?.name));
  }
  return items;
}

export async function submitProviderSkill(
  providerId: string,
  input: { skillId: string; level: ProviderSkillLevel },
  file?: Express.Multer.File,
) {
  const service = await Service.findById(input.skillId);
  if (!service) throw new AppError('Service not found.', 404, ErrorCode.NOT_FOUND);

  let documentUrl: string | undefined;
  let documentKey: string | undefined;
  if (file) {
    const stored = await storeFile(file.buffer, file.mimetype, `skills/${providerId}`);
    documentUrl = stored.fileUrl;
    documentKey = stored.fileKey;
  }

  const skill = await ProviderSkill.findOneAndUpdate(
    { providerId, skillId: input.skillId },
    {
      $set: {
        level: input.level,
        status: ProviderSkillStatus.PENDING,
        documentUrl,
        documentKey,
      },
    },
    { upsert: true, new: true },
  );

  return serializeSkill(skill, service.name);
}

export async function adminUpdateSkillStatus(
  adminId: string,
  skillId: string,
  input: { status: ProviderSkillStatus.VERIFIED | ProviderSkillStatus.REJECTED; reason?: string },
) {
  const skill = await ProviderSkill.findById(skillId);
  if (!skill) throw new AppError('Skill not found.', 404, ErrorCode.NOT_FOUND);
  const before = { status: skill.status };
  skill.status = input.status;
  if (input.status === ProviderSkillStatus.VERIFIED) {
    skill.verifiedAt = new Date();
    skill.verifiedBy = adminId as never;
    skill.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  }
  await skill.save();

  await AdminAuditLog.create({
    adminId,
    action: 'SKILL_STATUS_UPDATED',
    entityType: 'PROVIDER_SKILL',
    entityId: skill._id,
    before,
    after: { status: skill.status },
    reason: input.reason ?? 'Admin skill review',
  });

  const service = await Service.findById(skill.skillId).select('name');
  return serializeSkill(skill, service?.name);
}

export async function isProviderEligibleForService(providerId: string, serviceId: string): Promise<boolean> {
  const skill = await ProviderSkill.findOne({
    providerId,
    skillId: serviceId,
    status: ProviderSkillStatus.VERIFIED,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  });
  return Boolean(skill);
}

export async function expireSkills(): Promise<number> {
  const result = await ProviderSkill.updateMany(
    { status: ProviderSkillStatus.VERIFIED, expiresAt: { $lte: new Date() } },
    { $set: { status: ProviderSkillStatus.EXPIRED } },
  );
  return result.modifiedCount ?? 0;
}
