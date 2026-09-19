import { readFileSync } from 'node:fs';

export function loadIllustrationCatalog(path = 'config/scientific-religious-illustration-catalog-2026.json') {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function getIllustratedKnowledgeCard(topicId, catalog = loadIllustrationCatalog()) {
  const record = catalog.records?.find(item => item.topicId === topicId);
  if (!record) return null;

  return Object.freeze({
    topicId: record.topicId,
    title: record.title,
    quranReferences: record.quranReferences ?? [],
    interpretiveLayer: record.interpretiveLayer ?? null,
    knowledgeClaims: record.knowledgeClaims ?? [],
    illustrations: (record.illustrations ?? []).map(image => ({
      ...image,
      role: 'illustration_for_knowledge',
      isScientificEvidence: false
    })),
    provenance: record.provenance ?? null
  });
}

export function attachIllustrationsToKnowledgeResult(result, catalog = loadIllustrationCatalog()) {
  const topicId = result?.topicId;
  if (!topicId) return result;
  const card = getIllustratedKnowledgeCard(topicId, catalog);
  if (!card) return result;
  return Object.freeze({ ...result, illustratedKnowledgeCard: card });
}

export function filterMediaOutOfEncyclopediaSearch(results = []) {
  return results.filter(result => {
    const type = String(result?.type ?? result?.mediaType ?? '').toLowerCase();
    const category = String(result?.category ?? '').toLowerCase();
    if (type.includes('video') || type.includes('audio')) return false;
    if (category.includes('video') || category.includes('scientific_video')) return false;
    return true;
  });
}
