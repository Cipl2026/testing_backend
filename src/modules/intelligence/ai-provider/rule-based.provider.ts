import {
  ConfidenceLevel,
  IssueUrgency,
  type ImageClassificationResult,
  type IssueClassificationResult,
} from '@ghaarfix/shared-types';
import type { AIProvider, AIProviderConfig } from '@/modules/intelligence/ai-provider/ai-provider.interface.js';
import { Category } from '@/models/Category.js';
import {
  findBestServiceMatch,
  loadActiveServiceCatalog,
} from '@/modules/intelligence/ai-provider/service-catalog-matcher.js';

const EMERGENCY_KEYWORDS = [
  'gas leak',
  'smell gas',
  'fire',
  'smoke',
  'electric shock',
  'sparks',
  'flooding',
  'structural',
  'collapse',
];

const ISSUE_RULES: Array<{
  keywords: string[];
  category: string;
  serviceKeywords: string[];
  urgency: IssueUrgency;
  confidence: number;
  explanation: string;
}> = [
  {
    keywords: ['window ac', 'window air'],
    category: 'AC & Cooling',
    serviceKeywords: ['window ac'],
    urgency: IssueUrgency.NORMAL,
    confidence: 0.88,
    explanation: 'Based on your description, this may be a window AC issue.',
  },
  {
    keywords: ['split ac', 'split air'],
    category: 'AC & Cooling',
    serviceKeywords: ['split ac'],
    urgency: IssueUrgency.NORMAL,
    confidence: 0.88,
    explanation: 'Based on your description, this may be a split AC issue.',
  },
  {
    keywords: ['ac install', 'installation', 'new ac'],
    category: 'AC & Cooling',
    serviceKeywords: ['ac installation'],
    urgency: IssueUrgency.NORMAL,
    confidence: 0.8,
    explanation: 'Based on your description, you may need AC installation.',
  },
  {
    keywords: ['not cooling', 'cooling problem', 'warm air', 'gas refill', 'compressor'],
    category: 'AC & Cooling',
    serviceKeywords: ['cooling repair', 'ac cooling'],
    urgency: IssueUrgency.HIGH,
    confidence: 0.82,
    explanation: 'Based on your description, this may be an AC cooling or repair issue.',
  },
  {
    keywords: ['ac', 'air conditioner', 'cooling', 'noise'],
    category: 'AC & Cooling',
    serviceKeywords: ['ac'],
    urgency: IssueUrgency.NORMAL,
    confidence: 0.72,
    explanation: 'Based on your description, this may be an AC or cooling issue.',
  },
  {
    keywords: ['leak', 'dripping', 'water', 'pipe', 'tap', 'faucet', 'plumb'],
    category: 'Plumbing',
    serviceKeywords: ['plumb', 'pipe', 'leak', 'water'],
    urgency: IssueUrgency.HIGH,
    confidence: 0.8,
    explanation: 'Based on your description, this may be a plumbing issue.',
  },
  {
    keywords: ['electric', 'switch', 'wiring', 'power', 'fuse', 'mcb', 'short'],
    category: 'Electrical',
    serviceKeywords: ['electric', 'wiring', 'switch'],
    urgency: IssueUrgency.HIGH,
    confidence: 0.78,
    explanation: 'Based on your description, this may be an electrical issue.',
  },
  {
    keywords: ['purifier', 'ro', 'filter', 'water purifier'],
    category: 'Water Purifier',
    serviceKeywords: ['purifier', 'ro', 'filter'],
    urgency: IssueUrgency.NORMAL,
    confidence: 0.75,
    explanation: 'Based on your description, this may be a water purifier issue.',
  },
  {
    keywords: ['pest', 'cockroach', 'termite', 'rodent', 'insect'],
    category: 'Pest Control',
    serviceKeywords: ['pest', 'cockroach', 'termite'],
    urgency: IssueUrgency.NORMAL,
    confidence: 0.76,
    explanation: 'Based on your description, this may be a pest control issue.',
  },
];

function confidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.75) return ConfidenceLevel.HIGH;
  if (score >= 0.5) return ConfidenceLevel.MEDIUM;
  return ConfidenceLevel.LOW;
}

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

async function findMatchingService(userText: string, hintKeywords: string[]) {
  const catalog = await loadActiveServiceCatalog();
  const combined = `${userText} ${hintKeywords.join(' ')}`.trim();
  const match = findBestServiceMatch(combined, catalog);
  if (!match) return null;
  return {
    serviceId: match.id,
    serviceName: match.name,
    categoryId: match.categoryId,
  };
}

export class RuleBasedAIProvider implements AIProvider {
  readonly config: AIProviderConfig = {
    provider: 'RULE_BASED',
    modelName: 'ghaarfix-rules-v1',
    version: '1.0.0',
    timeoutMs: 5000,
    maxRetries: 1,
  };

  async classifyIssue(text: string): Promise<IssueClassificationResult> {
    const normalized = normalize(text);

    for (const emergency of EMERGENCY_KEYWORDS) {
      if (normalized.includes(emergency)) {
        return {
          category: 'Safety Emergency',
          confidence: 0.95,
          confidenceLevel: ConfidenceLevel.HIGH,
          urgency: IssueUrgency.EMERGENCY,
          riskFlags: ['SAFETY_EMERGENCY'],
          followUpQuestions: [],
          explanation:
            'This may be a safety emergency. Please contact emergency services immediately if you are in danger.',
          safetyEscalation: true,
          safetyMessage:
            'If you smell gas, see fire, or are at risk of electric shock, leave the area and call emergency services.',
        };
      }
    }

    let best = ISSUE_RULES.filter((rule) =>
      rule.keywords.some((kw) => normalized.includes(kw)),
    ).sort((a, b) => {
      const score = (rule: (typeof ISSUE_RULES)[number]) =>
        rule.keywords
          .filter((kw) => normalized.includes(kw))
          .reduce((sum, kw) => sum + kw.length + (kw.includes(' ') ? 4 : 0), 0);
      return score(b) - score(a);
    })[0];

    if (!best) {
      return {
        category: 'General Home Service',
        confidence: 0.35,
        confidenceLevel: ConfidenceLevel.LOW,
        urgency: IssueUrgency.NORMAL,
        riskFlags: [],
        followUpQuestions: [
          'Which room or appliance is affected?',
          'When did the issue start?',
          'Is there any visible damage or leaking?',
        ],
        explanation:
          'We need a bit more detail to suggest the right service. Please answer the follow-up questions.',
      };
    }

    const serviceMatch = await findMatchingService(normalized, best.serviceKeywords);
    let categoryId: string | undefined;
    if (serviceMatch?.categoryId) {
      categoryId = serviceMatch.categoryId;
    } else {
      const cat = await Category.findOne({ name: new RegExp(best.category, 'i') });
      categoryId = cat?._id.toString();
    }

    const followUpQuestions: string[] = [];
    if (best.confidence < 0.75) {
      followUpQuestions.push('Can you describe when the issue started?');
    }

    return {
      category: best.category,
      categoryId,
      serviceId: serviceMatch?.serviceId,
      serviceName: serviceMatch?.serviceName,
      confidence: best.confidence,
      confidenceLevel: confidenceLevel(best.confidence),
      urgency: best.urgency,
      riskFlags: [],
      followUpQuestions,
      explanation: best.explanation,
    };
  }

  async classifyImage(
    _imageBuffer: Buffer,
    mimeType: string,
  ): Promise<ImageClassificationResult> {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(mimeType)) {
      return {
        detectedIssues: [],
        confidence: 0,
        confidenceLevel: ConfidenceLevel.LOW,
        explanation: 'Unsupported image type for analysis.',
        requiresHumanReview: true,
      };
    }

    return {
      detectedIssues: ['Possible visible appliance or damage — review recommended'],
      confidence: 0.45,
      confidenceLevel: ConfidenceLevel.LOW,
      explanation:
        'A possible issue may be visible in the image. A technician can confirm after inspection.',
      requiresHumanReview: true,
    };
  }

  async chat(messages: Array<{ role: string; content: string }>): Promise<string> {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const lower = lastUser.toLowerCase();

    if (lower.includes('booking') && (lower.includes('status') || lower.includes('where'))) {
      return 'I can help with your booking status. Please share your booking number, or I can look up your recent bookings if you confirm.';
    }
    if (lower.includes('cancel')) {
      return 'To cancel a booking, I need your confirmation. Would you like me to help you find the booking first?';
    }
    if (lower.includes('invoice') || lower.includes('payment')) {
      return 'For invoice or payment questions, I can explain charges on your completed bookings. Share your booking number for details.';
    }
    if (lower.includes('care plan') || lower.includes('subscription')) {
      return 'Care Plan benefits depend on your active subscription. I can summarize your plan benefits if you would like.';
    }
    if (lower.includes('human') || lower.includes('support') || lower.includes('agent')) {
      return 'I can connect you with our support team. Would you like to create a support ticket?';
    }
    if (lower.includes('window ac') || lower.includes('split ac') || lower.includes('ac')) {
      return 'For AC issues, you can book Window AC Service, Split AC Service, or AC Cooling Repair from the Services tab. Tell me if it is not cooling, leaking, or making noise and I will suggest the best option.';
    }
    if (lower.includes('plumb') || lower.includes('leak') || lower.includes('tap') || lower.includes('pipe')) {
      return 'For plumbing issues like leaks or tap repair, open Services and choose Plumbing. You can also use Describe Issue for a service suggestion.';
    }
    if (lower.includes('electric') || lower.includes('wiring') || lower.includes('switch') || lower.includes('power')) {
      return 'Electrical issues should be handled by a certified electrician. Book an Electrical service from the app and mention if there are sparks or burning smell.';
    }
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('help')) {
      return 'Namaste! I help with home services on GhaarFix — AC, plumbing, electrical, appliance repair, bookings, and invoices. What issue are you facing at home?';
    }

    return `Thanks for your message. I can help you book home services, check bookings, or explain invoices. For "${lastUser.slice(0, 80)}", try Describe Issue on the home screen for a service recommendation, or browse Services to book directly.`;
  }
}
