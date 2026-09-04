import {
  ConfidenceLevel,
  IssueUrgency,
  type ImageClassificationResult,
  type IssueClassificationResult,
} from '@ghaarfix/shared-types';
import type { AIProvider, AIProviderConfig } from '@/modules/intelligence/ai-provider/ai-provider.interface.js';
import { RuleBasedAIProvider } from '@/modules/intelligence/ai-provider/rule-based.provider.js';
import {
  findBestServiceMatch,
  loadActiveServiceCatalog,
  resolveServiceByName,
} from '@/modules/intelligence/ai-provider/service-catalog-matcher.js';
import { validateIssueClassification } from '@/modules/intelligence/intelligence-schemas.js';
import { env } from '@/config/env.js';
import { logger } from '@/utils/logger.js';

const HOME_SERVICES_SCOPE = `You are the GhaarFix home-services assistant for India.
ONLY help with: home repairs, plumbing, electrical, AC/cooling, appliances, cleaning, pest control, bookings, rescheduling, invoices, payments, care plans, warranties, maintenance reminders, and using the GhaarFix app.
If the user asks about anything outside home services, politely refuse and redirect to home service topics.
Never invent booking IDs, prices, or provider names.`;

const ISSUE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    category: { type: 'string' },
    serviceName: { type: 'string' },
    confidence: { type: 'number' },
    confidenceLevel: { type: 'string' },
    urgency: { type: 'string' },
    riskFlags: { type: 'array', items: { type: 'string' } },
    followUpQuestions: { type: 'array', items: { type: 'string' } },
    explanation: { type: 'string' },
    safetyEscalation: { type: 'boolean' },
    safetyMessage: { type: 'string' },
  },
  required: [
    'category',
    'confidence',
    'confidenceLevel',
    'urgency',
    'riskFlags',
    'followUpQuestions',
    'explanation',
  ],
};

const FALLBACK_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
];

const rulesFallback = new RuleBasedAIProvider();

function confidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.75) return ConfidenceLevel.HIGH;
  if (score >= 0.5) return ConfidenceLevel.MEDIUM;
  return ConfidenceLevel.LOW;
}

function parseJsonFromModelText(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  return JSON.parse(candidate);
}

function normalizeUrgency(value: unknown): IssueUrgency {
  const raw = String(value ?? 'NORMAL').toUpperCase();
  if (raw in IssueUrgency) return IssueUrgency[raw as keyof typeof IssueUrgency];
  if (raw === 'MEDIUM') return IssueUrgency.NORMAL;
  return IssueUrgency.NORMAL;
}

function normalizeConfidenceLevel(value: unknown, confidence: number): ConfidenceLevel {
  const raw = String(value ?? '').toUpperCase();
  if (raw in ConfidenceLevel) return ConfidenceLevel[raw as keyof typeof ConfidenceLevel];
  return confidenceLevel(confidence);
}

type GeminiGenerationConfig = Record<string, unknown>;

export class GeminiAIProvider implements AIProvider {
  readonly config: AIProviderConfig = {
    provider: 'GEMINI',
    modelName: env.gemini.model,
    version: '1.3.0',
    timeoutMs: 45_000,
    maxRetries: 1,
  };

  async classifyIssue(text: string, context?: Record<string, unknown>): Promise<IssueClassificationResult> {
    const catalog = await loadActiveServiceCatalog();
    const serviceNames = catalog.map((s) => s.name);

    const prompt = `Classify this home-service issue for GhaarFix India.
Pick serviceName from this catalog (or leave empty if unsure): ${serviceNames.join(' | ')}

Issue: ${text}
Home context: ${JSON.stringify(context ?? {})}

Rules:
- Distinguish Window AC vs Split AC vs AC Cooling Repair vs AC Installation.
- If the customer mentions "window ac", prefer Window AC Service.
- If the customer mentions "split ac", prefer Split AC Service.
- Use EMERGENCY urgency only for gas leak, fire, electric shock, or flooding.`;

    try {
      const rawText = await this.generateContent({
        prompt,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          responseSchema: ISSUE_JSON_SCHEMA,
        },
      });
      const parsed = parseJsonFromModelText(rawText) as Record<string, unknown>;
      const confidence = Math.min(1, Math.max(0, Number(parsed.confidence ?? 0.5)));
      const matched =
        resolveServiceByName(typeof parsed.serviceName === 'string' ? parsed.serviceName : undefined, catalog) ??
        findBestServiceMatch(text, catalog);

      return validateIssueClassification({
        category: String(parsed.category ?? 'General Home Service'),
        categoryId: matched?.categoryId,
        serviceId: matched?.id,
        serviceName: matched?.name ?? (typeof parsed.serviceName === 'string' ? parsed.serviceName : undefined),
        confidence,
        confidenceLevel: normalizeConfidenceLevel(parsed.confidenceLevel, confidence),
        urgency: normalizeUrgency(parsed.urgency),
        riskFlags: Array.isArray(parsed.riskFlags) ? parsed.riskFlags.map(String) : [],
        followUpQuestions: Array.isArray(parsed.followUpQuestions)
          ? parsed.followUpQuestions.map(String).slice(0, 3)
          : [],
        explanation: String(parsed.explanation ?? 'Based on your description, here is a possible service match.'),
        safetyEscalation: Boolean(parsed.safetyEscalation),
        safetyMessage: typeof parsed.safetyMessage === 'string' ? parsed.safetyMessage : undefined,
      });
    } catch (error) {
      logger.warn('Gemini issue classification failed — switching to rule-based fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
      return rulesFallback.classifyIssue(text);
    }
  }

  async classifyImage(
    imageBuffer: Buffer,
    mimeType: string,
    _context?: Record<string, unknown>,
  ): Promise<ImageClassificationResult> {
    // Image analysis is not wired to Gemini yet — rules only when explicitly needed.
    return rulesFallback.classifyImage(imageBuffer, mimeType);
  }

  async chat(messages: Array<{ role: string; content: string }>): Promise<string> {
    const systemText = [
      HOME_SERVICES_SCOPE,
      ...messages.filter((m) => m.role === 'system').map((m) => m.content),
    ].join('\n');

    const turns = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
    const contents = turns.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    if (contents.length === 0) {
      throw new Error('No user message to send to Gemini');
    }

    try {
      const reply = await this.generateContent({
        systemInstruction: systemText,
        contents,
        generationConfig: {
          temperature: 0.45,
          maxOutputTokens: 2048,
        },
      });

      const trimmed = reply.trim();
      if (!trimmed) {
        throw new Error('Gemini returned an empty chat response');
      }

      return trimmed;
    } catch (error) {
      logger.warn('Gemini chat failed — switching to rule-based fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
      return rulesFallback.chat(messages);
    }
  }

  private async generateContent(input: {
    prompt?: string;
    systemInstruction?: string;
    contents?: Array<{ role: string; parts: Array<{ text: string }> }>;
    generationConfig?: GeminiGenerationConfig;
  }): Promise<string> {
    const apiKey = env.gemini.apiKey;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    const body: Record<string, unknown> = {
      generationConfig: {
        maxOutputTokens: 2048,
        ...input.generationConfig,
      },
    };

    if (input.systemInstruction) {
      body.systemInstruction = { parts: [{ text: input.systemInstruction }] };
    }

    if (input.contents?.length) {
      body.contents = input.contents;
    } else {
      body.contents = [{ role: 'user', parts: [{ text: input.prompt ?? '' }] }];
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${env.gemini.model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        const fallbackText = await this.tryAlternateModels(body, apiKey);
        if (fallbackText) return fallbackText;
        throw new Error(`Gemini API error ${response.status}: ${errorBody}`);
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
          finishReason?: string;
        }>;
      };

      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.map((p) => p.text).join('').trim();
      if (!text) {
        const fallbackText = await this.tryAlternateModels(body, apiKey);
        if (fallbackText) return fallbackText;
        throw new Error(`Empty Gemini response (${candidate?.finishReason ?? 'unknown'})`);
      }
      return text;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async tryAlternateModels(
    body: Record<string, unknown>,
    apiKey: string,
  ): Promise<string | null> {
    const models = [...new Set([env.gemini.model, ...FALLBACK_MODELS])];

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
        );

        if (!response.ok) continue;

        const data = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim();
        if (text) {
          if (model !== env.gemini.model) {
            logger.warn('Gemini primary model unavailable; used alternate model', { model });
          }
          return text;
        }
      } catch {
        // try next model
      }
    }

    return null;
  }
}
