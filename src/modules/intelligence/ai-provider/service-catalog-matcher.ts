import { Service } from '@/models/Service.js';

export interface ServiceCatalogEntry {
  id: string;
  name: string;
  categoryId?: string;
}

export async function loadActiveServiceCatalog(limit = 200): Promise<ServiceCatalogEntry[]> {
  const services = await Service.find({ isActive: true }).sort({ name: 1 }).limit(limit);
  return services.map((s) => ({
    id: s._id.toString(),
    name: s.name,
    categoryId: s.categoryId?.toString(),
  }));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

/** Score how well a catalog service matches the user's issue description. */
export function scoreServiceMatch(userText: string, serviceName: string): number {
  const normalized = userText.toLowerCase().trim();
  const name = serviceName.toLowerCase();
  if (!normalized || !name) return 0;

  let score = 0;

  // Phrase matches (e.g. "window ac" in "window ac service")
  const words = tokenize(normalized);
  for (let size = Math.min(4, words.length); size >= 2; size -= 1) {
    for (let i = 0; i <= words.length - size; i += 1) {
      const phrase = words.slice(i, i + size).join(' ');
      if (name.includes(phrase)) {
        score += size * 8;
      }
    }
  }

  // Individual word overlap
  const serviceWords = tokenize(name);
  for (const word of words) {
    if (serviceWords.includes(word)) {
      score += word.length >= 4 ? 3 : 2;
    }
  }

  // Full service name contained in user text (e.g. user pasted exact service)
  if (normalized.includes(name)) {
    score += 15;
  }

  return score;
}

export function findBestServiceMatch(
  userText: string,
  catalog: ServiceCatalogEntry[],
  minScore = 3,
): ServiceCatalogEntry | null {
  let best: { entry: ServiceCatalogEntry; score: number } | null = null;

  for (const entry of catalog) {
    const score = scoreServiceMatch(userText, entry.name);
    if (!best || score > best.score) {
      best = { entry, score };
    }
  }

  if (!best || best.score < minScore) return null;
  return best.entry;
}

export function resolveServiceByName(
  serviceName: string | undefined,
  catalog: ServiceCatalogEntry[],
): ServiceCatalogEntry | null {
  if (!serviceName?.trim()) return null;
  const target = serviceName.toLowerCase().trim();

  const exact = catalog.find((s) => s.name.toLowerCase() === target);
  if (exact) return exact;

  const contains = catalog.find(
    (s) => s.name.toLowerCase().includes(target) || target.includes(s.name.toLowerCase()),
  );
  if (contains) return contains;

  return findBestServiceMatch(serviceName, catalog, 2);
}
