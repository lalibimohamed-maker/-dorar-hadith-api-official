import { generateLocal, rerankLocal } from './local-llm-runtime.mjs';

const DEFAULT_SYSTEM_PROMPT = [
  'You are a source-grounded assistant for موسوعة دينُ اللّه.',
  'Use only the supplied evidence for factual religious claims.',
  'Do not invent citations, grades, quotations, chains, scholarly opinions, or Quran text.',
  'Never rewrite, normalize, correct, or generate a replacement for canonical Corpus text.',
  'Generated wording is an interpretation layer and is never canonical religious content.',
  'When evidence is insufficient, say that the available evidence is insufficient.',
  'Preserve scholarly disagreement and attribute positions to their sources.'
].join('\n');

function formatEvidence(records = []) {
  return records.slice(0, 8).map((record, index) => ({
    citationId: `E${index + 1}`,
    id: record.id ?? null,
    title: record.title ?? record.work ?? null,
    source: record.source ?? null,
    verification: record.verification ?? null,
    rights: record.rights ?? null,
    excerpt: String(record.excerpt ?? record.description ?? record.text ?? '').slice(0, 1800)
  }));
}

export async function runLocalGroundedAnswer({
  query,
  evidence = [],
  language = 'ar',
  modelId,
  modelPath,
  rerankerModelPath,
  env = process.env,
  maxEvidence = 8,
  maxTokens = 384,
  temperature = 0
} = {}) {
  if (typeof query !== 'string' || !query.trim()) throw new TypeError('query must be a non-empty string');
  const rawEvidence = Array.isArray(evidence) ? evidence : [];
  const snippets = rawEvidence.map(item => String(item.excerpt ?? item.description ?? item.text ?? item.title ?? '')).filter(Boolean);
  let rankedEvidence = formatEvidence(rawEvidence);

  if (snippets.length > 1 && env.DEEN_RERANKER_MODEL_PATH) {
    try {
      const ranked = await rerankLocal({
        query,
        documents: snippets,
        modelPath: rerankerModelPath,
        env
      });
      const rankByDocument = new Map(ranked.map(item => [item.document, item.score]));
      rankedEvidence = rankedEvidence
        .map(item => ({ ...item, rerankScore: rankByDocument.get(item.excerpt) ?? 0 }))
        .sort((a, b) => b.rerankScore - a.rerankScore)
        .slice(0, maxEvidence);
    } catch (error) {
      if (error?.code !== 'LOCAL_AI_RUNTIME_MISSING' && error?.code !== 'LOCAL_AI_MODEL_PATH_MISSING') throw error;
    }
  } else {
    rankedEvidence = rankedEvidence.slice(0, maxEvidence);
  }

  const evidenceBlock = rankedEvidence.map(item =>
    `[${item.citationId}] ${item.title || item.id || 'source'} | ${item.source || 'no-source'} | ${item.excerpt}`
  ).join('\n');

  const prompt = [
    `User language: ${language}`,
    `Question: ${query}`,
    'Evidence:',
    evidenceBlock || '[NO_VERIFIED_EVIDENCE]',
    'Answer with source identifiers such as [E1], [E2] beside supported statements.'
  ].join('\n\n');

  const generation = await generateLocal({
    modelId: modelId || undefined,
    prompt,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    modelPath,
    env,
    maxTokens,
    temperature
  });

  return Object.freeze({
    ...generation,
    language,
    query,
    evidence: rankedEvidence,
    policy: {
      sourceGrounded: true,
      canonicalCorpusMutation: false,
      generatedTextIsCanonical: false,
      acquisitionBlocking: false
    }
  });
}
