import { AsyncLocalStorage } from 'node:async_hooks';

export interface ObservabilityContext {
  requestId?: string;
  traceId?: string;
  userIdHash?: string;
  userType?: string;
}

const storage = new AsyncLocalStorage<ObservabilityContext>();

export function runWithObservabilityContext<T>(ctx: ObservabilityContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getObservabilityContext(): ObservabilityContext {
  return storage.getStore() ?? {};
}

export function setObservabilityContext(partial: Partial<ObservabilityContext>): void {
  const current = storage.getStore();
  if (current) Object.assign(current, partial);
}
