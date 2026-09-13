import { HomeHelpCompatibilityConfig } from '@/models/HomeHelpCompatibilityConfig.js';

export const DEFAULT_HOME_HELP_COMPATIBILITY = {
  maxTasksPerVisit: 8,
  specialistExclusive: true,
  requireHomeHelpForMixedGroups: true,
  stackingRules: [
    'Up to 8 tasks per Home Help visit.',
    'SPECIALIST tasks cannot be combined with any other task.',
    'Tasks from different compatibility groups require General Home Help (HOME_HELP group) in the visit.',
    'Same-group tasks (e.g. multiple CLEANING tasks) can be stacked freely.',
  ],
};

export type HomeHelpCompatibilityRuntimeConfig = typeof DEFAULT_HOME_HELP_COMPATIBILITY;

function serializeConfig(doc: InstanceType<typeof HomeHelpCompatibilityConfig>) {
  return {
    maxTasksPerVisit: doc.maxTasksPerVisit,
    specialistExclusive: doc.specialistExclusive,
    requireHomeHelpForMixedGroups: doc.requireHomeHelpForMixedGroups,
    stackingRules:
      doc.stackingRules.length > 0 ? doc.stackingRules : DEFAULT_HOME_HELP_COMPATIBILITY.stackingRules,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function getHomeHelpCompatibilityConfig(): Promise<HomeHelpCompatibilityRuntimeConfig> {
  const doc = await HomeHelpCompatibilityConfig.findOne({ key: 'global' });
  if (!doc) return DEFAULT_HOME_HELP_COMPATIBILITY;
  return {
    maxTasksPerVisit: doc.maxTasksPerVisit,
    specialistExclusive: doc.specialistExclusive,
    requireHomeHelpForMixedGroups: doc.requireHomeHelpForMixedGroups,
    stackingRules:
      doc.stackingRules.length > 0 ? doc.stackingRules : DEFAULT_HOME_HELP_COMPATIBILITY.stackingRules,
  };
}

export async function getHomeHelpCompatibilityConfigAdmin() {
  const doc = await HomeHelpCompatibilityConfig.findOne({ key: 'global' });
  if (!doc) {
    return {
      ...DEFAULT_HOME_HELP_COMPATIBILITY,
      updatedAt: null,
    };
  }
  return serializeConfig(doc);
}

export async function updateHomeHelpCompatibilityConfig(
  adminId: string,
  input: Partial<{
    maxTasksPerVisit: number;
    specialistExclusive: boolean;
    requireHomeHelpForMixedGroups: boolean;
    stackingRules: string[];
  }>,
) {
  const doc = await HomeHelpCompatibilityConfig.findOneAndUpdate(
    { key: 'global' },
    {
      $set: {
        ...input,
        updatedBy: adminId,
      },
      $setOnInsert: {
        key: 'global',
        maxTasksPerVisit: DEFAULT_HOME_HELP_COMPATIBILITY.maxTasksPerVisit,
        specialistExclusive: DEFAULT_HOME_HELP_COMPATIBILITY.specialistExclusive,
        requireHomeHelpForMixedGroups: DEFAULT_HOME_HELP_COMPATIBILITY.requireHomeHelpForMixedGroups,
        stackingRules: DEFAULT_HOME_HELP_COMPATIBILITY.stackingRules,
      },
    },
    { upsert: true, new: true },
  );
  return serializeConfig(doc);
}
