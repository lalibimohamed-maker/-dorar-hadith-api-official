import { createHash } from 'node:crypto';
import { access, stat, readFile } from 'node:fs/promises';

export const LOCAL_AI_SCHEMA_VERSION = '1.0.0';

export const LOCAL_MODEL_REGISTRY = Object.freeze({
  'qwen3-8b-instruct-q4_k_m': Object.freeze({
    id: 'qwen3-8b-instruct-q4_k_m',
    role: 'generation',
    format: 'gguf',
    source: 'https://huggingface.co/Qwen/Qwen3-8B-GGUF',
    license: 'Apache-2.0',
    licenseSource: 'https://huggingface.co/Qwen/Qwen3-8B-GGUF',
    pathEnv: 'DEEN_LLM_MODEL_PATH',
    sha256Env: 'DEEN_LLM_MODEL_SHA256',
    expectedSha256: null,
    notes: 'Official Qwen3 8B GGUF family; select a locally acquired quantization after rights/provenance review.'
  }),
  'bge-m3-q8_0': Object.freeze({
    id: 'bge-m3-q8_0',
    role: 'embedding',
    format: 'gguf',
    source: 'https://huggingface.co/cstr/bge-m3-GGUF',
    baseModelSource: 'https://huggingface.co/BAAI/bge-m3',
    license: 'MIT',
    licenseSource: 'https://huggingface.co/BAAI/bge-m3',
    pathEnv: 'DEEN_EMBEDDING_MODEL_PATH',
    sha256Env: 'DEEN_EMBEDDING_MODEL_SHA256',
    expectedSha256: null,
    embeddingDimensions: 1024,
    maxTokens: 8192,
    languages: '100+',
    notes: 'Community GGUF conversion of BGE-M3; conversion provenance must remain recorded.'
  }),
  'bge-reranker-v2-m3-q8_0': Object.freeze({
    id: 'bge-reranker-v2-m3-q8_0',
    role: 'reranker',
    format: 'gguf',
    source: 'https://huggingface.co/cstr/bge-reranker-v2-m3-GGUF',
    baseModelSource: 'https://huggingface.co/BAAI/bge-reranker-v2-m3',
    license: 'Apache-2.0',
    licenseSource: 'https://huggingface.co/BAAI/bge-reranker-v2-m3',
    pathEnv: 'DEEN_RERANKER_MODEL_PATH',
    sha256Env: 'DEEN_RERANKER_MODEL_SHA256',
    expectedSha256: null,
    notes: 'Community GGUF conversion; intended for multilingual cross-encoder reranking.'
  })
});

export function getLocalModelSpec(modelId) {
  const spec = LOCAL_MODEL_REGISTRY[modelId];
  if (!spec) {
    const error = new Error(`Unknown local AI model: ${modelId}`);
    error.code = 'LOCAL_AI_MODEL_UNKNOWN';
    throw error;
  }
  return spec;
}

function normalizeSha256(value) {
  return value ? String(value).trim().toLowerCase() : null;
}

export async function sha256File(filePath) {
  const hash = createHash('sha256');
  const bytes = await readFile(filePath);
  hash.update(bytes);
  return hash.digest('hex');
}

export function resolveExpectedSha256(spec, env = process.env) {
  return normalizeSha256(env[spec.sha256Env] || spec.expectedSha256);
}

export async function verifyLocalModelFile({ modelId, modelPath, env = process.env, requireSha256 = true } = {}) {
  const spec = getLocalModelSpec(modelId);
  if (!modelPath || typeof modelPath !== 'string') {
    const error = new Error(`${modelId} requires an explicit local model path`);
    error.code = 'LOCAL_AI_MODEL_PATH_MISSING';
    throw error;
  }

  await access(modelPath);
  const info = await stat(modelPath);
  if (!info.isFile() || info.size <= 0) {
    const error = new Error(`Local AI model is not a non-empty file: ${modelPath}`);
    error.code = 'LOCAL_AI_MODEL_FILE_INVALID';
    throw error;
  }

  const expectedSha256 = resolveExpectedSha256(spec, env);
  if (!expectedSha256) {
    if (requireSha256) {
      const error = new Error(`SHA-256 is required before loading ${modelId}`);
      error.code = 'LOCAL_AI_MODEL_SHA256_MISSING';
      throw error;
    }
    return Object.freeze({ modelId, modelPath, sizeBytes: info.size, sha256: null, verified: false });
  }

  if (!/^[0-9a-f]{64}$/.test(expectedSha256)) {
    const error = new Error(`Invalid SHA-256 for ${modelId}`);
    error.code = 'LOCAL_AI_MODEL_SHA256_INVALID';
    throw error;
  }

  const actualSha256 = await sha256File(modelPath);
  if (actualSha256 !== expectedSha256) {
    const error = new Error(`SHA-256 mismatch for ${modelId}`);
    error.code = 'LOCAL_AI_MODEL_SHA256_MISMATCH';
    error.expectedSha256 = expectedSha256;
    error.actualSha256 = actualSha256;
    throw error;
  }

  return Object.freeze({ modelId, modelPath, sizeBytes: info.size, sha256: actualSha256, verified: true });
}

export function requiredModelEnvironment(modelId) {
  const spec = getLocalModelSpec(modelId);
  return Object.freeze({ pathEnv: spec.pathEnv, sha256Env: spec.sha256Env });
}
