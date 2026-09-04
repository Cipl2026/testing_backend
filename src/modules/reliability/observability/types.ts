export type LogMeta = Record<string, unknown> & {
  requestId?: string;
  traceId?: string;
  userType?: string;
  userIdHash?: string;
  bookingId?: string;
  providerId?: string;
  organizationId?: string;
  errorCode?: string;
  service?: string;
  environment?: string;
  releaseVersion?: string;
};

export interface TraceSpan {
  traceId: string;
  spanId: string;
  end(): void;
}

export interface ObservabilityProvider {
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: LogMeta): void;
  recordMetric(name: string, value: number, labels?: Record<string, string>): void;
  recordException(error: unknown, context?: LogMeta): void;
  startTrace(name: string): TraceSpan;
  addTraceEvent(name: string, attributes?: Record<string, string>): void;
  setTraceAttribute(key: string, value: string): void;
}
