import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocalAIStatus, cosineSimilarity } from '../src/ai/local-llm-runtime.mjs';

test('local AI status is offline-first and acquisition independent', () => {
  const status = getLocalAIStatus({});
  assert.equal(status.networkRequiredForRuntime, false);
  assert.equal(status.autoDownloadModels, false);
  assert.equal(status.acquisitionBlocking, false);
  assert.equal(status.corpusMutation, false);
});

test('cosine similarity is deterministic', () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
});
