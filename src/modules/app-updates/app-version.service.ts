import {
  AppVersion,
  type MobileAppTarget,
  type MobilePlatform,
} from '@/models/AppVersion.js';
import { AdminAuditLog } from '@/models/AdminAuditLog.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';
import { buildPaginationMeta } from '@/utils/catalog.js';
import { compareSemver, isVersionBelow } from '@/modules/app-updates/version.utils.js';

export interface AppVersionCheckInput {
  app: MobileAppTarget;
  platform: MobilePlatform;
  currentVersion: string;
  buildNumber?: number;
}

export interface AppVersionCheckResult {
  latestVersion: string;
  minimumSupportedVersion: string;
  updateAvailable: boolean;
  forceUpdate: boolean;
  storeUrl: string;
  releaseNotes: string[];
}

export async function checkAppVersion(input: AppVersionCheckInput): Promise<AppVersionCheckResult> {
  const config = await AppVersion.findOne({
    app: input.app,
    platform: input.platform,
    isActive: true,
  });

  if (!config) {
    return {
      latestVersion: input.currentVersion,
      minimumSupportedVersion: input.currentVersion,
      updateAvailable: false,
      forceUpdate: false,
      storeUrl: '',
      releaseNotes: [],
    };
  }

  const belowMinimum =
    isVersionBelow(input.currentVersion, config.minimumSupportedVersion) ||
    (config.minimumBuildNumber != null &&
      input.buildNumber != null &&
      input.buildNumber < config.minimumBuildNumber);

  const belowLatest =
    compareSemver(input.currentVersion, config.latestVersion) < 0 ||
    (config.latestBuildNumber != null &&
      input.buildNumber != null &&
      input.buildNumber < config.latestBuildNumber);

  return {
    latestVersion: config.latestVersion,
    minimumSupportedVersion: config.minimumSupportedVersion,
    updateAvailable: belowLatest,
    forceUpdate: config.forceUpdate || belowMinimum,
    storeUrl: config.storeUrl,
    releaseNotes: config.releaseNotes,
  };
}

export async function adminListAppVersions(query: { page: number; limit: number; app?: string }) {
  const filter: Record<string, unknown> = {};
  if (query.app) filter.app = query.app;

  const total = await AppVersion.countDocuments(filter);
  const items = await AppVersion.find(filter)
    .sort({ app: 1, platform: 1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);

  return {
    items: items.map(serializeAppVersion),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function adminUpsertAppVersion(
  adminId: string,
  input: {
    app: MobileAppTarget;
    platform: MobilePlatform;
    latestVersion: string;
    minimumSupportedVersion: string;
    latestBuildNumber?: number;
    minimumBuildNumber?: number;
    forceUpdate?: boolean;
    storeUrl: string;
    releaseNotes?: string[];
    isActive?: boolean;
  },
) {
  const doc = await AppVersion.findOneAndUpdate(
    { app: input.app, platform: input.platform },
    {
      $set: {
        latestVersion: input.latestVersion,
        minimumSupportedVersion: input.minimumSupportedVersion,
        latestBuildNumber: input.latestBuildNumber,
        minimumBuildNumber: input.minimumBuildNumber,
        forceUpdate: input.forceUpdate ?? false,
        storeUrl: input.storeUrl,
        releaseNotes: input.releaseNotes ?? [],
        isActive: input.isActive ?? true,
      },
    },
    { upsert: true, new: true },
  );

  await AdminAuditLog.create({
    adminId,
    action: 'APP_VERSION_UPSERT',
    entityType: 'AppVersion',
    entityId: doc._id,
    reason: `Updated ${input.app} ${input.platform} app version policy`,
    after: {
      app: input.app,
      platform: input.platform,
      latestVersion: input.latestVersion,
      minimumSupportedVersion: input.minimumSupportedVersion,
      forceUpdate: input.forceUpdate ?? false,
    },
  });

  return serializeAppVersion(doc);
}

export async function adminDeleteAppVersion(adminId: string, id: string) {
  const doc = await AppVersion.findByIdAndDelete(id);
  if (!doc) throw new AppError('App version config not found.', 404, ErrorCode.NOT_FOUND);

  await AdminAuditLog.create({
    adminId,
    action: 'APP_VERSION_DELETE',
    entityType: 'AppVersion',
    entityId: doc._id,
    reason: `Removed ${doc.app} ${doc.platform} app version policy`,
    before: { app: doc.app, platform: doc.platform },
  });
}

function serializeAppVersion(doc: {
  _id: { toString(): string };
  app: MobileAppTarget;
  platform: MobilePlatform;
  latestVersion: string;
  minimumSupportedVersion: string;
  latestBuildNumber?: number;
  minimumBuildNumber?: number;
  forceUpdate: boolean;
  storeUrl: string;
  releaseNotes: string[];
  isActive: boolean;
  updatedAt: Date;
}) {
  return {
    id: doc._id.toString(),
    app: doc.app,
    platform: doc.platform,
    latestVersion: doc.latestVersion,
    minimumSupportedVersion: doc.minimumSupportedVersion,
    latestBuildNumber: doc.latestBuildNumber ?? null,
    minimumBuildNumber: doc.minimumBuildNumber ?? null,
    forceUpdate: doc.forceUpdate,
    storeUrl: doc.storeUrl,
    releaseNotes: doc.releaseNotes,
    isActive: doc.isActive,
    updatedAt: doc.updatedAt.toISOString(),
  };
}
