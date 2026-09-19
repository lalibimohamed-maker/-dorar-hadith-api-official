import fs from 'node:fs/promises';
import path from 'node:path';

const dir = process.argv[2] || 'artifacts/rechercher/global-multilingual-research';
const expected = Number(process.env.EXPECTED_CELL_COUNT || 3192);
const registry = JSON.parse(await fs.readFile('config/rechercher/global-multilingual-resource-discovery-2026.json', 'utf8'));
const languages = registry.enumerated_islamhouse_languages;
const domains = registry.resource_lanes;
const expectedCells = new Set(languages.flatMap((language) => domains.map((domain) => `islamhouse-133:${language}:${domain}`)));

if (registry.matrix.language_count !== languages.length || registry.matrix.domain_count !== domains.length || registry.matrix.expected_search_cells !== expected) {
  throw new Error(`Matrix contract mismatch: registry=${registry.matrix.language_count}x${registry.matrix.domain_count}/${registry.matrix.expected_search_cells}, configured=${languages.length}x${domains.length}/${expected}`);
}
if (expectedCells.size !== expected) throw new Error(`Expected matrix contains ${expectedCells.size} unique cells, not ${expected}`);

const files = (await fs.readdir(dir)).filter((name) => /^shard-\d+\.jsonl$/.test(name)).sort();
if (files.length !== 3) throw new Error(`Expected exactly 3 multilingual shard JSONL files; found ${files.length}`);

const seen = new Set();
const perShard = {};
for (const file of files) {
  const rows = (await fs.readFile(path.join(dir, file), 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
  const shard = file.match(/^shard-(\d+)\.jsonl$/)[1];
  perShard[shard] = rows.length;
  if (rows.length !== expected / 3) throw new Error(`${file}: expected ${expected / 3} rows, found ${rows.length}`);
  for (const row of rows) {
    if (!row.cell_id) throw new Error(`${file}: missing cell_id`);
    if (!expectedCells.has(row.cell_id)) throw new Error(`${file}: unexpected cell_id ${row.cell_id}`);
    if (seen.has(row.cell_id)) throw new Error(`Duplicate cell_id: ${row.cell_id}`);
    seen.add(row.cell_id);
    if (row.machine_translation_used === true) throw new Error(`Machine translation flag is forbidden in matrix cell: ${row.cell_id}`);
    if (row.canonical_arabic_overwrite === true) throw new Error(`Canonical Arabic overwrite is forbidden in matrix cell: ${row.cell_id}`);
    if (!Array.isArray(row.stages) || !row.stages.some((stage) => stage.stage === 'verification')) throw new Error(`Missing verification stage: ${row.cell_id}`);
  }
}

if (seen.size !== expected) throw new Error(`Matrix completeness failure: found ${seen.size} unique cells, expected ${expected}`);
for (const cell of expectedCells) if (!seen.has(cell)) throw new Error(`Missing matrix cell: ${cell}`);

const summary = {
  schema: 'rechercher/global-multilingual-matrix-verification/v1',
  verified_at: new Date().toISOString(),
  language_count: languages.length,
  domain_count: domains.length,
  expected_cell_count: expected,
  actual_cell_count: seen.size,
  shard_count: files.length,
  rows_per_shard: perShard,
  unique_cell_ids: seen.size,
  exact_matrix: true
};
await fs.writeFile(path.join(dir, 'matrix-verification-summary.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(summary));
