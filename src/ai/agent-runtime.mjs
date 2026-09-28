import { generateLocal } from './local-llm-runtime.mjs';
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

export async function runAgent({
  query,
  language = 'ar',
  modelId = 'qwen3-8b-instruct-q4_k_m',
  modelPath,
  env = process.env,
  signal,
  searchFn,
  generateFn = generateLocal,
  maxEvidence = 8,
  maxTokens = 384,
  temperature = 0
} = {}) {
  if (typeof query !== 'string' || !query.trim()) throw new TypeError('query must be a non-empty string');

  const route = routeIntent(query);
  const tool = await callAgentTool('search.unified', { query, intent: route.intent, language, signal, searchFn });
  const context = buildEvidenceContext(tool.search, { maxItems: maxEvidence });

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
