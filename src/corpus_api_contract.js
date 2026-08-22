/**
 * Corpus API contract layer.
 * Keeps API response semantics independent from the storage/search adapter.
 * Unverified records must never receive the trusted badge.
 */

function normalizeLanguage(requestedLanguage, browserLanguage = 'ar') {
  return requestedLanguage || browserLanguage || 'ar';
}

function searchResponse({ query, language, bilingual = false, results = [] }) {
  return {
    query,
    language: normalizeLanguage(language),
    bilingual,
    results: results.map(record => ({
      ...record,
      trusted: record.verification_state === 'verified'
    }))
  };
}

function conceptCard({ term, contextId, language, record, longPressSeconds = 5 }) {
  if (longPressSeconds < 5) {
    throw new Error('long_press_duration_must_be_at_least_5_seconds');
  }

  return {
    trigger: 'long_press',
    duration_seconds: longPressSeconds,
    term,
    context_id: contextId,
    language: normalizeLanguage(language),
    window: 'medium',
    source_on_demand: true,
    record: record
      ? { ...record, trusted: record.verification_state === 'verified' }
      : null
  };
}

function bilingualResult(originalArabic, meaningTranslation, targetLanguage) {
  return {
    original_arabic: originalArabic,
    meaning_translation: {
      language: targetLanguage,
      text: meaningTranslation
    },
    open_original_on_demand: true
  };
}

module.exports = {
  normalizeLanguage,
  searchResponse,
  conceptCard,
  bilingualResult
};
