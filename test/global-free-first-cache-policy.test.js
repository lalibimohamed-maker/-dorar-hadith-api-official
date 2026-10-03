import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const cfg = JSON.parse(fs.readFileSync(new URL('../config/global-content-cache-2026.json', import.meta.url), 'utf8'));

test('global cache is free-first and does not require paid dependencies', () => {
  assert.equal(cfg.costPolicy.freeFirst, true);
  assert.equal(cfg.costPolicy.noPaidDependencyRequired, true);
  assert.equal(cfg.costPolicy.localFirst, true);
});

test('cache reuse happens before remote search and reprocessing', () => {
  assert.equal(cfg.reuseRules.reuseBeforeRemoteSearch, true);
  assert.equal(cfg.reuseRules.reuseBeforeReprocessing, true);
});

test('translation and derived-edition caches are source-version aware', () => {
  assert.equal(cfg.translation.cachePerSourceEdition, true);
  assert.equal(cfg.translation.cachePerModelVersion, true);
  assert.equal(cfg.bookWorkflow.derivedEditionCache, true);
});

test('application history is distinct from browser-global history', () => {
  assert.equal(cfg.historyCalendar.scope, 'this-application-only');
  assert.equal(cfg.historyCalendar.doNotClaimAccessToBrowserGlobalHistory, true);
});

test('large local media uses OPFS and structured indexes use IndexedDB', () => {
  assert.equal(cfg.cacheLayers.find((x) => x.id === 'browser-structured-store').technology, 'IndexedDB');
  assert.equal(cfg.cacheLayers.find((x) => x.id === 'browser-large-media-store').technology, 'OPFS');
});
