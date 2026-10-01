import fs from 'node:fs/promises';
import path from 'node:path';

const dir = process.argv[2] || 'artifacts/rechercher/global-multilingual-research';
const outputDir = 'research/evidence/global-multilingual';
const files = (await fs.readdir(dir)).filter((name) => /^shard-\d+\.jsonl$/.test(name)).sort();
if (files.length !== 3) throw new Error(`Scientific ledger expected 3 shard JSONL files; found ${files.length}`);

const rows = [];
for (const file of files) {
  const text = await fs.readFile(path.join(dir, file), 'utf8');
  rows.push(...text.split('\n').filter(Boolean).map(JSON.parse));
}
const seen = new Set();
for (const row of rows) {
  if (!row.cell_id) throw new Error('Scientific ledger row is missing cell_id');
  if (seen.has(row.cell_id)) throw new Error(`Duplicate scientific ledger cell: ${row.cell_id}`);
  seen.add(row.cell_id);
}

await fs.mkdir(outputDir, {recursive: true});
const ledger = rows.sort((a, b) => a.cell_id.localeCompare(b.cell_id));
await fs.writeFile(path.join(outputDir, 'scientific-ledger.jsonl'), ledger.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf8');

const summary = {
  schema: 'rechercher/global-multilingual-scientific-ledger/v1',
  generated_at: new Date().toISOString(),
  source_shards: files,
  cell_count: ledger.length,
  unique_cell_count: seen.size,
  canonical_arabic_overwrite_cells: ledger.filter((row) => row.canonical_arabic_overwrite === true).length,
  machine_translation_cells: ledger.filter((row) => row.machine_translation_used === true).length,
  ledger_file: path.join(outputDir, 'scientific-ledger.jsonl')
};
if (summary.canonical_arabic_overwrite_cells !== 0 || summary.machine_translation_cells !== 0) {
  throw new Error('Scientific ledger integrity gate failed: forbidden translation mutation detected');
}
await fs.writeFile(path.join(outputDir, 'scientific-ledger-summary.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(summary));
