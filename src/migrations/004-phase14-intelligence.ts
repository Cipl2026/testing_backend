import { AIAnalysisResult } from '@/models/Intelligence.js';
import { IntelligenceModelVersion } from '@/models/Intelligence.js';
import { OperationalAnomaly } from '@/models/Intelligence.js';
import { DemandForecast } from '@/models/Intelligence.js';
import { ProviderMatchScore } from '@/models/Intelligence.js';
import { IntelligenceFeedback } from '@/models/Intelligence.js';
import { AIUsageMetric } from '@/models/Intelligence.js';
import { KnowledgeSource } from '@/models/Intelligence.js';
import { AssistantConversation } from '@/models/Intelligence.js';
import { logger } from '@/utils/logger.js';

export async function runPhase14Migrations() {
  await Promise.all([
    AIAnalysisResult.syncIndexes(),
    IntelligenceModelVersion.syncIndexes(),
    IntelligenceFeedback.syncIndexes(),
    OperationalAnomaly.syncIndexes(),
    DemandForecast.syncIndexes(),
    ProviderMatchScore.syncIndexes(),
    AIUsageMetric.syncIndexes(),
    KnowledgeSource.syncIndexes(),
    AssistantConversation.syncIndexes(),
  ]);
  logger.info('Phase 14 intelligence indexes ensured');
}
