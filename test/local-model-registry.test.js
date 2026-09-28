import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LOCAL_MODEL_REGISTRY, sha256File, verifyLocalModelFile } from '../src/ai/local-model-registry.mjs';

test('local model registry exposes generation, embedding and reranker roles', () => {
  assert.equal(LOCAL_MODEL_REGISTRY['qwen3-8b-instruct-q4_k_m'].role, 'generation');
  assert.equal(LOCAL_MODEL_REGISTRY['bge-m3-q8_0'].role, 'embedding');
  assert.equal(LOCAL_MODEL_REGISTRY['bge-reranker-v2-m3-q8_0'].role, 'reranker');
});

test('model verification fails closed without checksum', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'deen-local-ai-'));
  const file = join(dir, 'model.gguf');
  await writeFile(file, 'test-weight-fixture');
  await assert.rejects(
    () => verifyLocalModelFile({ modelId: 'qwen3-8b-instruct-q4_k_m', modelPath: file, env: {} }),
    error => error.code === 'LOCAL_AI_MODEL_SHA256_MISSING'
  );
});

test('model verification accepts a matching SHA-256', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'deen-local-ai-'));
  const file = join(dir, 'model.gguf');
  await writeFile(file, 'test-weight-fixture');
  const digest = await sha256File(file);
  const result = await verifyLocalModelFile({
    modelId: 'qwen3-8b-instruct-q4_k_m',
    modelPath: file,
    env: { DEEN_LLM_MODEL_SHA256: digest }
  });
  assert.equal(result.verified, true);
  assert.equal(result.sha256, digest);
});
