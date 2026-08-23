/** Corpus API contract layer. */
export function normalizeLanguage(requestedLanguage, browserLanguage = 'ar') {
  return requestedLanguage || browserLanguage || 'ar';
}

export function searchResponse({ query, language, results = [] }) {
  return {
    query,
    language: normalizeLanguage(language),
    bilingual: false,
    translationMode: 'disabled_for_search',
    results: results.map(r => ({ ...r, trusted: r.verification_state === 'verified' }))
  };
}

export function conceptCard({ term, contextId, language, record, routing = null, longPressSeconds = 5 }) {
  if (longPressSeconds < 5) throw new Error('long_press_duration_must_be_at_least_5_seconds');
  return {
    trigger: 'long_press',
    duration_seconds: longPressSeconds,
    term,
    context_id: contextId,
    language: normalizeLanguage(language),
    translationMode: 'disabled_for_long_press',
    window: 'medium',
    source_on_demand: true,
    record: record ? { ...record, trusted: record.verification_state === 'verified' } : null,
    methodology: routing
  };
}
