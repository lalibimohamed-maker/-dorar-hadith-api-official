import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const cfg = JSON.parse(fs.readFileSync(new URL('../config/global-encyclopedia-benchmark-2026.json', import.meta.url), 'utf8'));

test('global benchmark has major platform coverage', () => {
  const ids = new Set(cfg.benchmarks.map((x) => x.id));
  for (const id of ['dorar', 'quran-com', 'altafsir', 'sunnah-com', 'waqfeya', 'open-library', 'internet-archive']) {
    assert.equal(ids.has(id), true, `missing benchmark: ${id}`);
  }
});

test('benchmark priorities include missing research and user-experience capabilities', () => {
  const ids = new Set(cfg.priorityGaps.map((x) => x.id));
  for (const id of ['research-ux-parity','quran-study-ux','tafsir-depth-parity','library-discovery','bibliographic-identity','research-reproducibility','citation-graph','multimedia-study','personal-study','accessibility-and-localization','benchmark-evaluation']) {
    assert.equal(ids.has(id), true, `missing priority gap: ${id}`);
  }
});

test('existing architectural differentiators remain protected', () => {
  for (const id of ['source-and-edition-lineage','rights-aware-ingestion','no-single-engine scholarly authority']) {
    assert.ok(cfg.ourDistinctivesToPreserve.includes(id), `missing distinctive: ${id}`);
  }
  assert.ok(cfg.ourDistinctivesToPreserve.includes('global cross-system integration gate'));
});
