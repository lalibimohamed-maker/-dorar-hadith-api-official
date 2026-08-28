import { loadDhikrConfig } from './dhikr-orchestrator.mjs';

export function buildDailyCard({ date, sourceType, reference, text, translation = null }) {
  if (!date || !sourceType || !reference || !text) throw new Error('Daily card requires date, sourceType, reference and text');
  const config = loadDhikrConfig();
  if (!config.dailyCards.allowedSources.includes(sourceType)) throw new Error(`Source not allowed for daily card: ${sourceType}`);
  if (sourceType === 'Quran' && text.trim().length === 0) throw new Error('Quran text cannot be empty');
  return {
    date,
    sourceType,
    reference,
    text,
    translation,
    brand: config.dailyCards.brand,
    presentation: {
      background: 'derived-design',
      maxQuranAyahs: config.dailyCards.maxQuranAyahsPerCard,
      showSource: true,
      showOriginalText: true
    }
  };
}

export function isIslamicCard(card) {
  const config = loadDhikrConfig();
  return Boolean(card && config.dailyCards.allowedSources.includes(card.sourceType));
}
