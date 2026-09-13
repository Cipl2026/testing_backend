import { beforeAll, describe, expect, it } from 'vitest';
import '@/test/mongo-setup.js';
import { HomeHelpTaskPriority } from '@ghaarfix/shared-types';
import { quoteHomeHelpVisit } from '@/modules/home-help/home-help-quote.service.js';
import {
  sampleHomeHelpTasks,
  seedHomeHelpCatalogFixture,
} from '@/test/factories/home-help.factory.js';
import { HomeHelpCompatibilityConfig } from '@/models/HomeHelpCompatibilityConfig.js';

const describeMongo = process.env.MONGODB_URI ? describe : describe.skip;

describeMongo('home-help quote integration', () => {
  it('quotes a valid Home Help visit from seeded catalog', async () => {
    const fixture = await seedHomeHelpCatalogFixture();

    const quote = await quoteHomeHelpVisit({
      durationPackageId: fixture.durationPackageId,
      tasks: sampleHomeHelpTasks(fixture.cleaningTaskId),
    });

    expect(quote.durationPackage.durationMinutes).toBe(120);
    expect(quote.tasks).toHaveLength(1);
    expect(quote.subtotal).toBeGreaterThan(0);
  });

  it('respects admin compatibility max task limit', async () => {
    const fixture = await seedHomeHelpCatalogFixture();
    await HomeHelpCompatibilityConfig.create({
      key: 'global',
      maxTasksPerVisit: 1,
      specialistExclusive: true,
      requireHomeHelpForMixedGroups: true,
      stackingRules: ['Only one task in tests'],
    });

    await expect(
      quoteHomeHelpVisit({
        durationPackageId: fixture.durationPackageId,
        tasks: [
          { serviceId: fixture.cleaningTaskId, priority: HomeHelpTaskPriority.HIGH },
          { serviceId: fixture.laundryTaskId, priority: HomeHelpTaskPriority.MEDIUM },
        ],
      }),
    ).rejects.toThrow(/up to 1 tasks/i);
  });
});
