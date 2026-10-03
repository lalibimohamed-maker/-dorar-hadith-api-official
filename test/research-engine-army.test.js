import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const configPath = new URL('../config/research-engine-army-2026.json', import.meta.url);
const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));

test('research engine army is free-first and provenance governed', () => {
  assert.equal(cfg.policy.freeFirst, true);
  assert.equal(cfg.policy.openSourcePreferred, true);
  assert.equal(cfg.policy.noPaidDependencyRequired, true);
  assert.equal(cfg.policy.noSingleEngineMayEstablishScholarlyTruth, true);
  assert.equal(cfg.policy.contradictionDetection, true);
  assert.equal(cfg.policy.preserveProvenance, true);
});

test('specialist coverage spans text, books, scholarship, visual, audio and video', () => {
  const groups = Object.keys(cfg.specialistGroups);
  for (const required of [
    'web_general_and_meta',
    'official_and_institutional',
    'scholarly',
    'books_and_libraries',
    'images_and_visual_evidence',
    'audio_and_video',
    'documents_and_local_corpus'
  ]) assert.ok(groups.includes(required));
});

test('synthesis controller fails closed on unsupported certainty', () => {
  const forbidden = new Set(cfg.synthesisController.forbiddenOutputs);
  assert.ok(forbidden.has('unsupported_claim_presented_as_fact'));
  assert.ok(forbidden.has('synthetic_citation'));
  assert.ok(forbidden.has('silent_resolution_of_primary_source_conflict'));
  assert.ok(forbidden.has('single_engine_certainty'));
});

test('open book APIs are treated with provider-specific policy rather than bulk harvesting assumptions', () => {
  const openLibrary = cfg.specialistGroups.books_and_libraries.find(x => x.id === 'open-library');
  assert.equal(openLibrary.policy, 'human-facing-low-volume-and-cache');
  const youtube = cfg.specialistGroups.audio_and_video.find(x => x.id === 'youtube-data-api');
  assert.equal(youtube.policy, 'quota-and-terms-gated');
});
