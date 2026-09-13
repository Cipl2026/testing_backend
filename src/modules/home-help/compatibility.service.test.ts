import { describe, expect, it } from 'vitest';
import {
  HomeHelpCompatibilityGroup,
  HomeHelpTaskPriority,
  ServiceProviderType,
} from '@ghaarfix/shared-types';
import type { IService } from '@/models/Service.js';
import {
  defaultTaskPriority,
  sortTasksByPriority,
  validateHomeHelpTaskSelection,
} from '@/modules/home-help/compatibility.service.js';

function makeService(id: string, group: HomeHelpCompatibilityGroup): IService {
  return {
    _id: { toString: () => id },
    providerType: ServiceProviderType.HOME_HELP_PRO,
    hourlyEligible: true,
    compatibilityGroup: group,
    name: `Task ${id}`,
  } as unknown as IService;
}

describe('home-help compatibility', () => {
  it('sorts tasks by priority', () => {
    const sorted = sortTasksByPriority([
      { priority: HomeHelpTaskPriority.LOW, label: 'c' },
      { priority: HomeHelpTaskPriority.HIGH, label: 'a' },
      { priority: HomeHelpTaskPriority.MEDIUM, label: 'b' },
    ]);
    expect(sorted.map((item) => item.label)).toEqual(['a', 'b', 'c']);
  });

  it('assigns sensible default priorities', () => {
    expect(defaultTaskPriority(0)).toBe(HomeHelpTaskPriority.HIGH);
    expect(defaultTaskPriority(2)).toBe(HomeHelpTaskPriority.MEDIUM);
    expect(defaultTaskPriority(4)).toBe(HomeHelpTaskPriority.LOW);
  });

  it('rejects incompatible task groups', () => {
    const cleaning = makeService('1', HomeHelpCompatibilityGroup.CLEANING);
    const laundry = makeService('2', HomeHelpCompatibilityGroup.LAUNDRY);
    expect(() =>
      validateHomeHelpTaskSelection(
        [
          { serviceId: '1', priority: HomeHelpTaskPriority.HIGH },
          { serviceId: '2', priority: HomeHelpTaskPriority.MEDIUM },
        ],
        [cleaning, laundry],
      ),
    ).toThrow(/cannot be combined/i);
  });

  it('allows mixed groups when general home help is included', () => {
    const general = makeService('1', HomeHelpCompatibilityGroup.HOME_HELP);
    const cleaning = makeService('2', HomeHelpCompatibilityGroup.CLEANING);
    expect(() =>
      validateHomeHelpTaskSelection(
        [
          { serviceId: '1', priority: HomeHelpTaskPriority.HIGH },
          { serviceId: '2', priority: HomeHelpTaskPriority.MEDIUM },
        ],
        [general, cleaning],
        general,
      ),
    ).not.toThrow();
  });
});
