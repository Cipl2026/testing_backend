import http from 'node:http';
import { createApp } from '@/app.js';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { env } from '@/config/env.js';
import { attachSocketServer, closeSocketServer } from '@/config/socket.js';
import { registerJobs, runStartupJobs, stopJobs } from '@/jobs/index.js';
import { closeQueues, initQueues } from '@/infra/queue.service.js';
import { closeRedis, getRedisClient } from '@/infra/redis.js';
import { runPhase11Jobs } from '@/modules/operations/phase11-jobs.js';
import { seedAdminUser } from '@/modules/auth/auth.service.js';
import { seedDefaultAssetTypes } from '@/modules/home-health/admin.service.js';
import { seedDevEnvironment } from '@/scripts/seed-dev.js';
import { runPhase11Migrations } from '@/migrations/001-phase11-indexes.js';
import { runPhase12Migrations } from '@/migrations/002-phase12-care-plans.js';
import { runPhase13Migrations } from '@/migrations/003-phase13-organizations.js';
import { runPhase14Migrations } from '@/migrations/004-phase14-intelligence.js';
import { runPhase15Migrations } from '@/migrations/005-phase15-marketplace.js';
import { runPhase16Migrations } from '@/migrations/006-phase16-iot.js';
import { runPhase17Migrations } from '@/migrations/007-phase17-network.js';
import { runPhase18Migrations } from '@/migrations/008-phase18-trust.js';
import { runPhase19Migrations } from '@/migrations/009-phase19-finance.js';
import { runPhase20Migrations } from '@/migrations/010-phase20-lifecycle-growth.js';
import { runPhase21Migrations } from '@/migrations/011-phase21-reliability.js';
import { runPhase22Migrations } from '@/migrations/012-phase22-security.js';
import { runPhase23Migrations } from '@/migrations/013-phase23-performance.js';
import { runPhase24Migrations } from '@/migrations/014-phase24-globalization.js';
import { installDbProfiler } from '@/middleware/dbProfiler.js';
import { processIoTEvent } from '@/modules/iot/event-processor.service.js';
import { markShuttingDown } from '@/modules/reliability/health-check.service.js';
import { QueueName } from '@ghaarfix/shared-types';
import { validateProductionSecrets } from '@/modules/security/secret-provider.service.js';
import { logger } from '@/utils/logger.js';

export const app = createApp();
const httpServer = http.createServer(app);

let shuttingDown = false;

attachSocketServer(httpServer);
registerJobs();

async function start(): Promise<void> {
  validateProductionSecrets();
  await connectDatabase();
  await runStartupJobs();
  await runPhase11Migrations();
  await runPhase12Migrations();
  await runPhase13Migrations();
  await runPhase14Migrations();
  await runPhase15Migrations();
  await runPhase16Migrations();
  await runPhase17Migrations();
  await runPhase18Migrations();
  await runPhase19Migrations();
  await runPhase20Migrations();
  await runPhase21Migrations();
  await runPhase22Migrations();
  await runPhase23Migrations();
  await runPhase24Migrations();
  installDbProfiler();

  await getRedisClient();
  await initQueues({
    cleanup: async () => {
      await runPhase11Jobs();
    },
    [QueueName.IOT_EVENTS]: async (data) => {
      const eventId = data.eventId as string;
      if (eventId) await processIoTEvent(eventId);
    },
  });

  if (!env.isProd && !env.isTest) {
    await seedAdminUser();
    await seedDefaultAssetTypes();
    await seedDevEnvironment();
  }

  httpServer.listen(env.port, () => {
    logger.startup(`GhaarFix API → http://localhost:${env.port} (${env.nodeEnv})`);
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | void> {
  return Promise.race([
    promise,
    new Promise<void>((resolve) => {
      setTimeout(() => {
        logger.warn('Graceful shutdown step timed out', { label, ms });
        resolve();
      }, ms);
    }),
  ]);
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  markShuttingDown();
  logger.info('Shutting down', { signal });

  const timeoutMs = env.gracefulShutdownMs;

  await withTimeout(
    new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    }),
    timeoutMs,
    'http',
  );

  stopJobs();
  await withTimeout(closeQueues(), timeoutMs, 'queues');
  await withTimeout(closeSocketServer(), timeoutMs, 'socket');
  await withTimeout(closeRedis(), timeoutMs, 'redis');
  await withTimeout(disconnectDatabase(), timeoutMs, 'mongo');

  process.exit(0);
}

if (env.nodeEnv !== 'test') {
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  start().catch((error: unknown) => {
    logger.error('Failed to start server', { error });
    process.exit(1);
  });
}
