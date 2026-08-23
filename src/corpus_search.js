import { searchResponse, conceptCard } from './corpus_api_contract.js';
import { routeConcept } from './methodology-router.js';
import { loadConceptIndex } from './corpus_repository.js';
import { resolveGhaybDomain } from './ghayb-router.js';

const VERIFIED = new Set(['verified','source-verified','edition-verified','institution-verified','scholar-reviewed']);

function normalizeArabic(value = '') {
  return String(value).normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ـ/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function searchable(record) {
  return normalizeArabic([
    record.id, record.title_ar, record.title, record.text, record.textOriginal, record.sourceId, record.sourceType,
    record.domain, record.attribution?.authorOrScholar, record.attribution?.institution, record.author, record.authorName,
    record.citation?.book, record.citation?.chapter, record.citation?.hadithNumber, record.citation?.verse
  ].filter(Boolean).join(' '));
}

function scoreRecord(record, query, tokens) {
  const title = normalizeArabic(record.title_ar || record.title || '');
  const text = normalizeArabic(record.text || record.textOriginal || '');
  const id = normalizeArabic(record.id || record.sourceId || '');
  const author = normalizeArabic(record.author || record.authorName || record.attribution?.authorOrScholar || '');
  const institution = normalizeArabic(record.attribution?.institution || '');
  const haystack = searchable(record);
  let score = 0;
  if (title === query) score += 120;
  else if (title.includes(query)) score += 60;
  if (text.includes(query)) score += 35;
  if (id.includes(query)) score += 20;
  if (author.includes(query)) score += 25;
  if (institution.includes(query)) score += 15;
  const coverage = tokens.length ? tokens.filter(token => haystack.includes(token)).length / tokens.length : 0;
  score += Math.round(coverage * 30);
  if (coverage === 1 && tokens.length > 1) score += 15;
  if (VERIFIED.has(record.verification_state) || VERIFIED.has(record.reviewStatus) || record.status === 'verified') score += 5;
  return { score, coverage };
}

function resolveIndexedConcept(term) {
  const normalized = normalizeArabic(term);
  const index = loadConceptIndex();
  const groups = index.groups || {};
  for (const [group, terms] of Object.entries(groups)) {
    const hit = (terms || []).find(item => normalizeArabic(item) === normalized || normalizeArabic(item).includes(normalized) || normalized.includes(normalizeArabic(item)));
    if (hit) {
      const domain = group === 'aqidah' ? 'aqidah' : group === 'quran' || group === 'language' ? 'quran-tafsir' : group === 'hadith' ? 'hadith-takhrij' : group === 'fiqh' || group === 'usul' ? 'fiqh' : group === 'seerah' ? 'seerah' : 'general';
      return { id: `concept-index:${group}:${hit}`, type: 'concept', domain, title_ar: hit, index_group: group, index_match: true };
    }
  }
  const aliases = index.aliases || {};
  for (const [canonical, aliasList] of Object.entries(aliases)) {
    const matched = [canonical, ...(aliasList || [])].some(alias => {
      const value = normalizeArabic(alias);
      return value === normalized || value.includes(normalized) || normalized.includes(value);
    });
    if (!matched) continue;
    for (const [group, terms] of Object.entries(groups)) {
      if ((terms || []).some(item => normalizeArabic(item) === normalizeArabic(canonical))) {
        const domain = group === 'aqidah' ? 'aqidah' : group === 'quran' || group === 'language' ? 'quran-tafsir' : group === 'hadith' ? 'hadith-takhrij' : group === 'fiqh' || group === 'usul' ? 'fiqh' : group === 'seerah' ? 'seerah' : 'general';
        return { id:`concept-index:${group}:${canonical}`, type:'concept', domain, title_ar:canonical, index_group:group, index_match:true, alias_match:normalized!==normalizeArabic(canonical), matched_term:term };
      }
    }
  }
  return null;
}

export function searchCorpus(query, options = {}, records = []) {
  const language = options.language || 'ar';
  const normalized = normalizeArabic(query);
  if (!normalized) return searchResponse({ query, language, results: [] });
  const tokens = normalized.split(' ').filter(Boolean);
  const limit = Number(options.limit) > 0 ? Math.min(Number(options.limit), 100) : 50;
  const matches = records.map(record => ({ record, ...scoreRecord(record, normalized, tokens) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || b.coverage - a.coverage)
    .slice(0, limit)
    .map(({ record, score, coverage }) => ({
      ...record,
      score,
      token_coverage: coverage,
      trusted: VERIFIED.has(record.verification_state) || VERIFIED.has(record.reviewStatus) || record.status === 'verified',
      methodology: routeConcept(record, options)
    }));
  return searchResponse({ query, language, results: matches });
}

export function resolveConcept(term, contextId, language = 'ar', records = [], options = {}) {
  const normalized = normalizeArabic(term);
  const record = records.find(r => r.id === contextId)
    || records.find(r => normalizeArabic(r.title_ar || r.title) === normalized)
    || records.find(r => normalizeArabic(r.title_ar || r.title).includes(normalized))
    || resolveIndexedConcept(term)
    || resolveGhaybDomain(term);
  return conceptCard({ term, contextId: contextId || record?.id || null, language, record, routing: routeConcept(record, options) });
}
