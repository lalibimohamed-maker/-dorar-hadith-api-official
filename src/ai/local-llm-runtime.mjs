import { getLocalModelSpec, verifyLocalModelFile } from './local-model-registry.mjs';

const MODEL_CACHE = new Map();
let LLAMA_MODULE_PROMISE;

async function loadLlamaModule() {
  if (!LLAMA_MODULE_PROMISE) {
    LLAMA_MODULE_PROMISE = import('node-llama-cpp').catch((error) => {
      const wrapped = new Error('node-llama-cpp is not installed. Install it in the local runtime environment before enabling local AI.');
      wrapped.code = 'LOCAL_AI_RUNTIME_MISSING';
      wrapped.cause = error;
      throw wrapped;
    });
  }
  return LLAMA_MODULE_PROMISE;
}

function envValue(name, env = process.env) {
  const value = env[name];
  return value && String(value).trim() ? String(value).trim() : null;
}

export function getLocalAIStatus(env = process.env) {
  return {
    runtime: 'node-llama-cpp',
    roles: {
      generation: Boolean(envValue('DEEN_LLM_MODEL_PATH', env)),
      embedding: Boolean(envValue('DEEN_EMBEDDING_MODEL_PATH', env)),
      reranker: Boolean(envValue('DEEN_RERANKER_MODEL_PATH', env))
    },
    networkRequiredForRuntime: false,
    autoDownloadModels: false,
    corpusMutation: false,
    acquisitionBlocking: false,
    packageLoad: 'lazy'
  };
}

async function getModel(modelId, { modelPath, env = process.env, requireSha256 = true, modelOptions = {} } = {}) {
  const spec = getLocalModelSpec(modelId);
  const resolvedPath = modelPath || envValue(spec.pathEnv, env);
  const verification = await verifyLocalModelFile({ modelId, modelPath: resolvedPath, env, requireSha256 });
  const cacheKey = `${modelId}:${verification.sha256 || verification.sizeBytes}:${resolvedPath}`;

  if (!MODEL_CACHE.has(cacheKey)) {
    MODEL_CACHE.set(cacheKey, (async () => {
      const { getLlama } = await loadLlamaModule();
      const llama = await getLlama();
      const model = await llama.loadModel({ modelPath: resolvedPath, ...modelOptions });
      return { llama, model, verification, spec };
    })());
  }
  return MODEL_CACHE.get(cacheKey);
}

export async function loadLocalModel(options = {}) {
  return getModel(options.modelId, options);
}

export async function tokenizeLocal({ modelId, text, modelPath, env = process.env } = {}) {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  const { model } = await getModel(modelId, { modelPath, env });
  const tokens = model.tokenize(text);
  return Object.freeze({ modelId, tokens, count: tokens.length, text });
}

export async function detokenizeLocal({ modelId, tokens, modelPath, env = process.env } = {}) {
  if (!Array.isArray(tokens)) throw new TypeError('tokens must be an array');
  const { model } = await getModel(modelId, { modelPath, env });
  return model.detokenize(tokens);
}

export async function generateLocal({
  modelId = 'qwen3-8b-instruct-q4_k_m',
  prompt,
  systemPrompt,
  modelPath,
  env = process.env,
  signal,
  maxTokens = 256,
  temperature = 0,
  contextOptions = {},
  promptOptions = {}
} = {}) {
  if (typeof prompt !== 'string' || !prompt.trim()) throw new TypeError('prompt must be a non-empty string');
  const { LlamaChatSession } = await loadLlamaModule();
  const { model } = await getModel(modelId, { modelPath, env });
  const context = await model.createContext({ sequences: 1, ...contextOptions });
  const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
    ...(systemPrompt ? { systemPrompt } : {})
  });

  try {
    const response = await session.prompt(prompt, {
      maxTokens,
      temperature,
      signal,
      stopOnAbortSignal: true,
      ...promptOptions
    });
    return Object.freeze({
      modelId,
      text: response,
      verification: 'local-model-sha256-verified',
      generated: true,
      canonicalCorpusMutation: false
    });
  } finally {
    session.dispose();
    await context.dispose();
  }
}

export async function embedLocal({ modelId = 'bge-m3-q8_0', texts, modelPath, env = process.env, contextOptions = {} } = {}) {
  const inputs = Array.isArray(texts) ? texts : [texts];
  if (!inputs.length || inputs.some(text => typeof text !== 'string')) throw new TypeError('texts must be a non-empty string array');
  const { model } = await getModel(modelId, { modelPath, env });
  const context = await model.createEmbeddingContext(contextOptions);
  try {
    const embeddings = [];
    for (const text of inputs) {
      const embedding = await context.getEmbeddingFor(text);
      embeddings.push([...embedding.vector]);
    }
    return Object.freeze({ modelId, dimensions: embeddings[0]?.length || 0, embeddings });
  } finally {
    await context.dispose();
  }
}

export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return 0;
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = Number(a[i]) || 0;
    const bv = Number(b[i]) || 0;
    dot += av * bv;
    aNorm += av * av;
    bNorm += bv * bv;
  }
  return aNorm && bNorm ? dot / Math.sqrt(aNorm * bNorm) : 0;
}

export async function rerankLocal({
  modelId = 'bge-reranker-v2-m3-q8_0',
  query,
  documents,
  modelPath,
  env = process.env,
  rankingOptions = {}
} = {}) {
  if (typeof query !== 'string' || !query.trim()) throw new TypeError('query must be a non-empty string');
  if (!Array.isArray(documents) || documents.some(document => typeof document !== 'string')) throw new TypeError('documents must be a string array');
  if (!documents.length) return [];
  const { model } = await getModel(modelId, { modelPath, env });
  const context = await model.createRankingContext({});
  try {
    const scored = await context.rankAndSort(query, documents, rankingOptions);
    return scored.map(({ document, score }) => ({ document, score }));
  } finally {
    await context.dispose();
  }
}

export async function disposeLocalModels() {
  const values = await Promise.all([...MODEL_CACHE.values()]);
  MODEL_CACHE.clear();
  const seen = new Set();
  for (const entry of values) {
    if (seen.has(entry.model)) continue;
    seen.add(entry.model);
    await entry.model.dispose();
  }
}
