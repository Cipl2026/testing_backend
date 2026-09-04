import { DisasterRecoveryPlan } from '@/models/Reliability.js';

const DEFAULT_DR_PLANS = [
  {
    key: 'mongodb-outage',
    title: 'MongoDB Primary Outage',
    failureScenario: 'Primary MongoDB cluster unavailable',
    rtoMinutes: 60,
    rpoMinutes: 15,
    recoveryProcedure:
      'Fail over to replica set secondary. Verify connection string. Run health checks. Reconcile in-flight bookings.',
    verificationSteps:
      'Confirm /health/ready returns 200. Verify booking creation. Reconcile financial ledger events since last backup.',
    owner: 'Platform Team',
  },
  {
    key: 'redis-outage',
    title: 'Redis / Queue Outage',
    failureScenario: 'Redis unavailable affecting queues and rate limits',
    rtoMinutes: 30,
    rpoMinutes: 5,
    recoveryProcedure:
      'Enable graceful fallback mode. Process critical jobs synchronously. Restore Redis from snapshot.',
    verificationSteps:
      'Verify queue depth returns to normal. Confirm no duplicate webhook processing.',
    owner: 'Platform Team',
  },
  {
    key: 'payment-gateway-outage',
    title: 'Payment Gateway Outage',
    failureScenario: 'Razorpay or payment provider unavailable',
    rtoMinutes: 15,
    rpoMinutes: 0,
    recoveryProcedure:
      'Do not mark payments successful without verified webhook. Queue payment reconciliation. Notify customers of delayed confirmation.',
    verificationSteps:
      'Reconcile payment events against provider dashboard. Verify ledger entries match.',
    owner: 'Finance Ops',
  },
];

export async function seedDisasterRecoveryPlans(): Promise<void> {
  for (const plan of DEFAULT_DR_PLANS) {
    await DisasterRecoveryPlan.findOneAndUpdate({ key: plan.key }, plan, { upsert: true });
  }
}

export async function listDisasterRecoveryPlans() {
  const rows = await DisasterRecoveryPlan.find().sort({ key: 1 });
  return rows.map((r) => ({
    id: r._id.toString(),
    key: r.key,
    title: r.title,
    failureScenario: r.failureScenario,
    rtoMinutes: r.rtoMinutes,
    rpoMinutes: r.rpoMinutes,
    recoveryProcedure: r.recoveryProcedure,
    verificationSteps: r.verificationSteps,
    owner: r.owner,
    lastTestedAt: r.lastTestedAt,
  }));
}

export async function getFinancialReconciliationChecklist() {
  return {
    steps: [
      'Reconcile payment webhooks against provider dashboard',
      'Verify refund events in financial ledger',
      'Verify provider payout entries',
      'Check for duplicate ledger entries using idempotency keys',
      'Validate booking payment status matches ledger',
    ],
    note: 'Database restore alone does not guarantee financial consistency.',
  };
}
