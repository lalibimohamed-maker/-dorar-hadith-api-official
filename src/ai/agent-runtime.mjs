import { generateLocal, embedLocal, rerankLocal, cosineSimilarity } from './local-llm-runtime.mjs';
import { routeIntent } from './agent-intent-router.mjs';
import { callAgentTool } from './agent-tool-registry.mjs';
import { buildEvidenceContext, formatEvidenceForPrompt } from './evidence-context-builder.mjs';
import { verifyAgentResponse } from './response-verifier.mjs';

const SYSTEM_PROMPT = [
  'You are the grounded response agent for موسوعة دينُ اللّه.',
  'Use only the supplied evidence.',
  'Never invent an ayah, hadith, grading, chain, scholar attribution, ruling, citation, page or source.',
  'Do not rewrite or generate replacement canonical Quran or hadith text.',
  'Keep scholarly disagreement attributed and explicit.',
  'When evidence is insufficient, state that the available evidence is insufficient.',
  'Return JSON only: {"answer":"...","citations":["E1","E2"]}.'
].join('\n');

function parseModelOutput(raw) {
  const text = String(raw?.text ?? raw ?? '').trim();
  try {
    const parsed = JSON.parse(text);
    return {
      answer: String(parsed.answer || '').trim(),
      citations: Array.isArray(parsed.citations) ? parsed.citations.map(String) : [],
      format: 'json'
    };
  } catch {
    return { answer: text, citations: [], format: 'text-fallback' };
  }
}

export async function retrieveAgentEvidence({
  query,
  searchResult,
  env = process.env,
  maxEvidence = 8,
  maxCandidates = 24,
  embeddingModelId = 'bge-m3-q8_0',
  embeddingModelPath,
  rerankerModelId = 'bge-reranker-v2-m3-q8_0',
  rerankerModelPath,
  embedFn = embedLocal,
  rerankFn = rerankLocal
} = {}) {
  const candidateContext = buildEvidenceContext(searchResult, { maxItems: maxCandidates });
  let candidates = candidateContext.evidence.map(item => ({ ...item }));
  const retrieval = {
    candidateCount: candidates.length,
    semantic: { active: false, reason: 'not-configured' },
    reranker: { active: false, reason: 'not-configured' }
  };

  const configuredEmbedding = Boolean(env.DEEN_EMBEDDING_MODEL_PATH || embeddingModelPath);
  if (configuredEmbedding && candidates.length > 1) {
    try {
      const embedded = await embedFn({
        modelId: embeddingModelId,
        texts: [query, ...candidates.map(item => item.text)],
        modelPath: embeddingModelPath,
        env
      });
      const queryVector = embedded.embeddings[0];
      candidates = candidates.map((item, index) => ({
        ...item,
        semanticScore: cosineSimilarity(queryVector, embedded.embeddings[index + 1])
      })).sort((a, b) => b.semanticScore - a.semanticScore);
      retrieval.semantic = { active: true, reason: 'local-embedding', modelId: embeddingModelId };
    } catch (error) {
      if (!['LOCAL_AI_RUNTIME_MISSING', 'LOCAL_AI_MODEL_PATH_MISSING'].includes(error?.code)) throw error;
      retrieval.semantic = { active: false, reason: error.code };
    }
  }

  const configuredReranker = Boolean(env.DEEN_RERANKER_MODEL_PATH || rerankerModelPath);
  if (configuredReranker && candidates.length > 1) {
    const shortlist = candidates.slice(0, Math.max(maxEvidence * 2, maxEvidence));
    const ranked = await rerankFn({
      modelId: rerankerModelId,
      query,
      documents: shortlist.map(item => item.text),
      modelPath: rerankerModelPath,
      env
    });
    const scoreByText = new Map(ranked.map(item => [item.document, item.score]));
    candidates = candidates.map(item => ({
      ...item,
      rerankScore: scoreByText.has(item.text) ? scoreByText.get(item.text) : null
    })).sort((a, b) => {
      const ar = Number.isFinite(a.rerankScore) ? a.rerankScore : -Infinity;
      const br = Number.isFinite(b.rerankScore) ? b.rerankScore : -Infinity;
      if (ar !== br) return br - ar;
      return (b.semanticScore || 0) - (a.semanticScore || 0);
    });
    retrieval.reranker = { active: true, reason: 'local-cross-encoder', modelId: rerankerModelId };
  }

  const evidence = candidates.slice(0, maxEvidence);
  return Object.freeze({
    ...candidateContext,
    evidence,
    count: evidence.length,
    hasSufficientEvidence: evidence.length > 0,
    retrieval
  });
}

export async function runAgent({
  query,
  language = 'ar',
  modelId = 'qwen3-8b-instruct-q4_k_m',
  modelPath,
  env = process.env,
  signal,
  searchFn,
  generateFn = generateLocal,
  embedFn = embedLocal,
  rerankFn = rerankLocal,
  embeddingModelId = 'bge-m3-q8_0',
  embeddingModelPath,
  rerankerModelId = 'bge-reranker-v2-m3-q8_0',
  rerankerModelPath,
  maxEvidence = 8,
  maxCandidates = 24,
  maxTokens = 384,
  temperature = 0
} = {}) {
  if (typeof query !== 'string' || !query.trim()) throw new TypeError('query must be a non-empty string');

  const route = routeIntent(query);
  const tool = await callAgentTool('search.unified', { query, intent: route.intent, language, signal, searchFn });
  const context = await retrieveAgentEvidence({
    query,
    searchResult: tool.search,
    env,
    maxEvidence,
    maxCandidates,
    embeddingModelId,
    embeddingModelPath,
    rerankerModelId,
    rerankerModelPath,
    embedFn,
    rerankFn
  });

  if (!context.hasSufficientEvidence) {
    const refusal = language === 'ar'
      ? 'لا تتوفر أدلة كافية في النتائج الحالية للإجابة بأمان.'
      : 'The available search results do not contain sufficient evidence to answer safely.';
    const verification = verifyAgentResponse({ answer: refusal, evidence: [], intent: route.intent });
    return Object.freeze({
      agent: 'din-allah-grounded-agent-v1',
      model: null,
      route,
      evidence: context,
      verification,
      search: tool.search,
      generated: false,
      acquisitionBlocking: false,
      canonicalCorpusMutation: false
    });
  }

  const prompt = [
    `Language: ${language}`,
    `Intent: ${route.intent}`,
    `Question: ${query}`,
    'Evidence:',
    formatEvidenceForPrompt(context.evidence),
    'Answer only from those evidence items. Cite supported statements with [E#].'
  ].join('\n\n');

  const generated = await generateFn({
    modelId,
    modelPath,
    env,
    prompt,
    systemPrompt: SYSTEM_PROMPT,
    signal,
    maxTokens,
    temperature
  });

  const parsed = parseModelOutput(generated);
  const verification = verifyAgentResponse({
    answer: parsed.answer,
    claimedCitations: parsed.citations,
    evidence: context.evidence,
    intent: route.intent,
    evidenceRequired: true
  });

  return Object.freeze({
    agent: 'din-allah-grounded-agent-v1',
    model: generated.modelId || modelId,
    route,
    evidence: context,
    verification,
    search: tool.search,
    generated: true,
    format: parsed.format,
    acquisitionBlocking: false,
    canonicalCorpusMutation: false
  });
}
