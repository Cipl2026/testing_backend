import {
  ConnectedDevice,
  HomeAlert,
  IoTEvent,
  IoTIntegrationConnection,
  IoTRule,
  IoTRuleTemplate,
} from '@/models/IoT.js';
import {
  IoTRuleActionType,
  IoTRuleScope,
} from '@ghaarfix/shared-types';
import { FeatureFlag } from '@/models/FeatureFlag.js';
import { FeatureFlagKey } from '@ghaarfix/shared-types';
import { logger } from '@/utils/logger.js';

export async function runPhase16Migrations() {
  await Promise.all([
    IoTIntegrationConnection.syncIndexes(),
    ConnectedDevice.syncIndexes(),
    IoTEvent.syncIndexes(),
    HomeAlert.syncIndexes(),
    IoTRule.syncIndexes(),
    IoTRuleTemplate.syncIndexes(),
  ]);

  const templateCount = await IoTRuleTemplate.countDocuments();
  if (templateCount === 0) {
    const leakTemplate = await IoTRuleTemplate.create({
      name: 'Leak Detection Alert',
      description: 'Critical alert when leak sensor reports water',
      conditions: {
        type: 'EVENT_TYPE',
        eventType: 'LEAK_DETECTED',
      },
      actions: [
        {
          type: IoTRuleActionType.CREATE_ALERT,
          config: { title: 'Possible leak detected', message: 'A leak sensor reported water.' },
        },
        { type: IoTRuleActionType.SUGGEST_SERVICE, config: {} },
      ],
      version: 1,
      status: 'ACTIVE',
    });

    await IoTRule.create({
      scope: IoTRuleScope.GLOBAL_TEMPLATE,
      name: leakTemplate.name,
      description: leakTemplate.description,
      conditions: leakTemplate.conditions,
      actions: leakTemplate.actions,
      priority: 10,
      enabled: true,
      templateId: leakTemplate._id,
      templateVersion: leakTemplate.version,
    });

    await IoTRuleTemplate.create({
      name: 'High Humidity Insight',
      description: 'Recommend inspection when humidity exceeds threshold',
      conditions: {
        type: 'METRIC_THRESHOLD',
        metric: 'humidity',
        operator: 'gt',
        value: 75,
      },
      actions: [{ type: IoTRuleActionType.CREATE_INSIGHT, config: {} }],
      version: 1,
      status: 'ACTIVE',
    });

    logger.info('Phase 16 IoT seed rule templates created');
  }

  for (const key of [FeatureFlagKey.ENABLE_IOT, FeatureFlagKey.ENABLE_IOT_ALERTS]) {
    await FeatureFlag.findOneAndUpdate(
      { key },
      { key, enabled: true, rules: [{ type: 'global' }] },
      { upsert: true },
    );
  }

  logger.info('Phase 16 IoT indexes ensured');
}
