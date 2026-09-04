#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';

const INDEX_STATE = 'data/corpus/waqfeya/century-15/index-state.json';
const WORKFLOW_DIR = '.github/workflows';
const SHARD_SIZE = 100;
const JOBS_PER_FAMILY = 8;
const FAMILY_CAPACITY = SHARD_SIZE * JOBS_PER_FAMILY;
const INITIAL_FAMILIES = 10;
const FAMILY_PREFIX = 'waqfeya-harvest-';

function yamlForFamily(familyNumber, starts) {
  const matrix = starts.join(',');
  return `name: Waqfeya Harvest ${String(familyNumber).padStart(2, '0')}\n\non:\n  push:\n    branches: [feat/real-corpus-acquisition-2026]\n    paths: [data/corpus/waqfeya/century-15/index.jsonl]\n  workflow_dispatch:\n\npermissions:\n  contents: read\n\njobs:\n  shard:\n    strategy:\n      fail-fast: false\n      matrix:\n        book_start: [${matrix}]\n    uses: ./.github/workflows/waqfeya-harvest-reusable.yml\n    with:\n      shard_id: century15-${'{'}{ matrix.book_start }}\n      book_start: ${'{'}{ matrix.book_start }}\n      book_count: 100\n`;
}

async function main() {
  const state = JSON.parse(await (await import('node:fs/promises')).readFile(INDEX_STATE, 'utf8'));
  const target = Number(state.declaredCount || state.discoveredCount || 0);
  if (!Number.isFinite(target) || target <= 0) throw new Error('Invalid declared/discovered count');

  const requiredFamilies = Math.max(INITIAL_FAMILIES, Math.ceil(target / FAMILY_CAPACITY));
  await mkdir(WORKFLOW_DIR, { recursive: true });

  const generated = [];
  for (let family = 1; family <= requiredFamilies; family += 1) {
    const starts = [];
    const familyStart = (family - 1) * FAMILY_CAPACITY;
    for (let j = 0; j < JOBS_PER_FAMILY; j += 1) starts.push(familyStart + j * SHARD_SIZE);
    const path = `${WORKFLOW_DIR}/${FAMILY_PREFIX}${String(family).padStart(2, '0')}.yml`;
    generated.push({ path, content: yamlForFamily(family, starts), family, familyStart });
  }

  console.log(JSON.stringify({ targetBooks: target, requiredFamilies, totalCapacity: requiredFamilies * FAMILY_CAPACITY, generated }, null, 2));
}

main().catch((error) => { console.error(error.stack || error.message || error); process.exitCode = 1; });
