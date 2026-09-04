import { CircuitBreakerState } from '@ghaarfix/shared-types';
import { metricsService } from '@/modules/reliability/metrics.service.js';
import { logger } from '@/utils/logger.js';

interface BreakerConfig {
  failureThreshold: number;
  cooldownMs: number;
  halfOpenMaxAttempts: number;
}

interface BreakerState {
  state: CircuitBreakerState;
  failures: number;
  lastFailureAt?: number;
  halfOpenAttempts: number;
}

const breakers = new Map<string, BreakerState>();

const DEFAULT_CONFIG: BreakerConfig = {
  failureThreshold: 5,
  cooldownMs: 30_000,
  halfOpenMaxAttempts: 1,
};

function getState(name: string): BreakerState {
  let state = breakers.get(name);
  if (!state) {
    state = { state: CircuitBreakerState.CLOSED, failures: 0, halfOpenAttempts: 0 };
    breakers.set(name, state);
  }
  return state;
}

export class CircuitOpenError extends Error {
  constructor(name: string) {
    super(`Circuit breaker open for ${name}`);
    this.name = 'CircuitOpenError';
  }
}

export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  config: Partial<BreakerConfig> = {},
): Promise<T> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const breaker = getState(name);
  const now = Date.now();

  if (breaker.state === CircuitBreakerState.OPEN) {
    const elapsed = now - (breaker.lastFailureAt ?? 0);
    if (elapsed < cfg.cooldownMs) {
      metricsService.counter('circuit_breaker_rejected_total', 1, { breaker: name });
      throw new CircuitOpenError(name);
    }
    breaker.state = CircuitBreakerState.HALF_OPEN;
    breaker.halfOpenAttempts = 0;
  }

  try {
    const result = await fn();
    if (breaker.state === CircuitBreakerState.HALF_OPEN) {
      breaker.state = CircuitBreakerState.CLOSED;
      breaker.failures = 0;
      breaker.halfOpenAttempts = 0;
      metricsService.counter('circuit_breaker_closed_total', 1, { breaker: name });
      logger.info('Circuit breaker closed', { breaker: name });
    }
    return result;
  } catch (error) {
    breaker.failures += 1;
    breaker.lastFailureAt = now;

    if (breaker.state === CircuitBreakerState.HALF_OPEN) {
      breaker.halfOpenAttempts += 1;
      breaker.state = CircuitBreakerState.OPEN;
      metricsService.counter('circuit_breaker_opened_total', 1, { breaker: name });
      logger.warn('Circuit breaker reopened from half-open', { breaker: name });
      throw error;
    }

    if (breaker.failures >= cfg.failureThreshold) {
      breaker.state = CircuitBreakerState.OPEN;
      metricsService.counter('circuit_breaker_opened_total', 1, { breaker: name });
      logger.warn('Circuit breaker opened', { breaker: name, failures: breaker.failures });
    }

    throw error;
  }
}

export function getCircuitBreakerStates(): Array<{ name: string; state: CircuitBreakerState; failures: number }> {
  return [...breakers.entries()].map(([name, s]) => ({
    name,
    state: s.state,
    failures: s.failures,
  }));
}

export function resetCircuitBreaker(name: string): void {
  breakers.delete(name);
}

export function resetAllCircuitBreakers(): void {
  breakers.clear();
}
