import type {
  ImageClassificationResult,
  IssueClassificationResult,
} from '@ghaarfix/shared-types';

export interface AIProviderConfig {
  provider: string;
  modelName: string;
  version: string;
  timeoutMs: number;
  maxRetries: number;
}

export interface AIProvider {
  readonly config: AIProviderConfig;
  classifyIssue(text: string, context?: Record<string, unknown>): Promise<IssueClassificationResult>;
  classifyImage(
    imageBuffer: Buffer,
    mimeType: string,
    context?: Record<string, unknown>,
  ): Promise<ImageClassificationResult>;
  chat(messages: Array<{ role: string; content: string }>): Promise<string>;
}

export interface GenerateStructuredInput<T> {
  schemaName: string;
  prompt: string;
  validate: (data: unknown) => T;
}
