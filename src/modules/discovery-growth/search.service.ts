import { SearchResultType } from '@ghaarfix/shared-types';
import { Category } from '@/models/Category.js';
import { SearchQueryLog } from '@/models/SearchQueryLog.js';
import { SearchSynonym } from '@/models/SearchSynonym.js';
import { Service } from '@/models/Service.js';
import { normalizeSearchQuery } from '@/modules/discovery-growth/hash.util.js';
import { escapeRegex } from '@/utils/catalog.js';

interface SearchOptions {
  customerId?: string;
  page?: number;
  limit?: number;
}

async function expandQueryWithSynonyms(query: string): Promise<string[]> {
  const normalized = normalizeSearchQuery(query);
  const terms = new Set([normalized]);

  const synonyms = await SearchSynonym.find({
    isActive: true,
    $or: [{ term: normalized }, { synonyms: normalized }],
  });

  for (const entry of synonyms) {
    terms.add(entry.term);
    for (const synonym of entry.synonyms) {
      terms.add(normalizeSearchQuery(synonym));
    }
  }

  return Array.from(terms);
}

async function logSearch(
  query: string,
  resultCount: number,
  customerId?: string,
): Promise<void> {
  const normalizedQuery = normalizeSearchQuery(query);
  await SearchQueryLog.create({
    query,
    normalizedQuery,
    customerId,
    resultCount,
    isZeroResult: resultCount === 0,
  });
}

export async function search(query: string, options: SearchOptions = {}) {
  const page = options.page ?? 1;
  const limit = options.limit ?? 20;
  const expandedTerms = await expandQueryWithSynonyms(query);
  const searchPhrase = expandedTerms.join(' ');

  let services: InstanceType<typeof Service>[] = [];
  try {
    services = await Service.find(
      { isActive: true, $text: { $search: searchPhrase } },
      { score: { $meta: 'textScore' } },
    )
      .sort({ score: { $meta: 'textScore' }, displayOrder: 1 })
      .skip((page - 1) * limit)
      .limit(limit);
  } catch {
    services = [];
  }

  if (services.length === 0) {
    const regex = new RegExp(expandedTerms.map(escapeRegex).join('|'), 'i');
    services = await Service.find({
      isActive: true,
      $or: [{ name: regex }, { searchText: regex }, { keywords: regex }, { aliases: regex }],
    })
      .sort({ displayOrder: 1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit);
  }

  const categories = await Category.find({
    isActive: true,
    name: new RegExp(escapeRegex(query), 'i'),
  })
    .sort({ displayOrder: 1 })
    .limit(5);

  const suggestions = expandedTerms
    .filter((t) => t !== normalizeSearchQuery(query))
    .slice(0, 5)
    .map((term) => ({ type: SearchResultType.SUGGESTION, label: term }));

  const serviceItems = services.map((s) => ({
    type: SearchResultType.SERVICE,
    id: s._id.toString(),
    name: s.name,
    slug: s.slug,
    shortDescription: s.shortDescription,
  }));

  const categoryItems = categories.map((c) => ({
    type: SearchResultType.CATEGORY,
    id: c._id.toString(),
    name: c.name,
    slug: c.slug,
  }));

  const totalResults = serviceItems.length + categoryItems.length;
  await logSearch(query, totalResults, options.customerId);

  return {
    services: serviceItems,
    categories: categoryItems,
    suggestions,
    meta: { page, limit, total: totalResults },
  };
}

export async function getSuggestions(query: string, limit = 8) {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return { suggestions: [] };

  const expandedTerms = await expandQueryWithSynonyms(query);
  const regex = new RegExp(escapeRegex(normalized), 'i');

  const [services, synonyms] = await Promise.all([
    Service.find({ isActive: true, $or: [{ name: regex }, { aliases: regex }] })
      .sort({ displayOrder: 1 })
      .limit(limit)
      .select('name slug'),
    SearchSynonym.find({ isActive: true, term: regex }).limit(3),
  ]);

  const suggestions = [
    ...services.map((s) => ({ type: SearchResultType.SERVICE, label: s.name, id: s._id.toString() })),
    ...expandedTerms
      .filter((t) => t !== normalized)
      .map((term) => ({ type: SearchResultType.SUGGESTION, label: term })),
    ...synonyms.flatMap((s) => s.synonyms.map((syn) => ({ type: SearchResultType.SUGGESTION, label: syn }))),
  ];

  return { suggestions: suggestions.slice(0, limit) };
}

export async function getSearchInsights(limit = 20) {
  const zeroResults = await SearchQueryLog.aggregate([
    { $match: { isZeroResult: true } },
    { $group: { _id: '$normalizedQuery', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);

  const topSearches = await SearchQueryLog.aggregate([
    { $group: { _id: '$normalizedQuery', count: { $sum: 1 }, zeroCount: { $sum: { $cond: ['$isZeroResult', 1, 0] } } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);

  return { zeroResults, topSearches };
}
