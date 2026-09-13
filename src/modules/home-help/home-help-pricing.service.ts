export type HomeHelpBundleTier = {
  minTasks: number;
  percentOffAddons: number;
  label: string;
};

export const HOME_HELP_BUNDLE_TIERS: HomeHelpBundleTier[] = [
  { minTasks: 3, percentOffAddons: 10, label: '3+ tasks bundle (10% off add-ons)' },
  { minTasks: 5, percentOffAddons: 15, label: '5+ tasks bundle (15% off add-ons)' },
];

export function resolveHomeHelpBundleDiscount(taskCount: number, taskAddonTotal: number) {
  if (taskAddonTotal <= 0 || taskCount < 3) {
    return { discountAmount: 0, label: undefined as string | undefined, percent: 0 };
  }

  const tier = [...HOME_HELP_BUNDLE_TIERS]
    .reverse()
    .find((item) => taskCount >= item.minTasks);

  if (!tier) {
    return { discountAmount: 0, label: undefined as string | undefined, percent: 0 };
  }

  const discountAmount = Math.round((taskAddonTotal * tier.percentOffAddons) / 100);
  return {
    discountAmount,
    label: tier.label,
    percent: tier.percentOffAddons,
  };
}
