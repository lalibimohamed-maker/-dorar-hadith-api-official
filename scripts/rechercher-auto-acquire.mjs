#!/usr/bin/env node
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { buildAutoAcquisitionPlan } from '../src/rechercher-auto-acquisition.js';

const INPUT_PATH = process.env.INPUT_PATH ?? 'data/corpus/rechercher/discovered-books.jsonl';
const OUTPUT_DIR = process.env.OUTPUT_DIR ?? 'data/corpus/rechercher/acquired';
const PLAN_PATH = process.env.PLAN_PATH ?? 'data/corpus/rechercher/auto-acquisition-plan.jsonl';
const CONCURRENCY = Math.max(1, Number.parseInt(process.env.CONCURRENCY ?? '2', 10) || 2);
const USER_AGENT = process.env.USER_AGENT ?? 'DeenAllah-Rechercher/1.0 (+source-aware-acquisition)';

const rows = (await (await import('node:fs/promises')).readFile(INPUT_PATH, 'utf8'))
  .split(/\r?\n/).filter(Boolean).map(JSON.parse);
const plan = buildAutoAcquisitionPlan(rows);
await mkdir(OUTPUT_DIR, { recursive: true });
await mkdir(PLAN_PATH.slice(0, PLAN_PATH.lastIndexOf('/')) || '.', { recursive: true });
await writeFile(PLAN_PATH, plan.map(JSON.stringify).join('\n') + (plan.length ? '\n' : ''));

let cursor = 0;
const results = [];

async function worker() {
  while (cursor < plan.length) {
    const index = cursor++;
    const item = plan[index];
    if (!item.outcome.startsWith('AUTO_DOWNLOAD')) {
      results[index] = { ...item, status: 'SKIPPED', reason: 'rights-not-cleared-for-download' };
      continue;
    }

    const original = rows[index] ?? {};
    const extension = String(original.fileExtension ?? original.extension ?? 'pdf').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
    const safeId = String(item.id ?? `record-${index + 1}`).replace(/[^a-z0-9._-]/gi, '_');
    const finalPath = `${OUTPUT_DIR}/${safeId}.${extension}`;
    const tempPath = `${finalPath}.part`;

    try {
      const response = await fetch(item.downloadUrl, {
        redirect: 'follow',
        headers: { 'user-agent': USER_AGENT }
      });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

      const hash = createHash('sha256');
      const hashingStream = new Readable({
        async read() {
          const reader = response.body.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              hash.update(value);
              this.push(value);
            }
            this.push(null);
          } catch (error) {
            this.destroy(error);
          }
        }
      });
      await pipeline(hashingStream, createWriteStream(tempPath));
      const sha256 = hash.digest('hex');

      if (original.sha256 && String(original.sha256).toLowerCase() !== sha256) {
        throw new Error(`SHA-256 mismatch: expected ${original.sha256}, got ${sha256}`);
      }

      await rename(tempPath, finalPath);
      results[index] = { ...item, status: 'DOWNLOADED', path: finalPath, sha256 };
    } catch (error) {
      try { await (await import('node:fs/promises')).rm(tempPath, { force: true }); } catch {}
      results[index] = { ...item, status: 'FAILED', error: error instanceof Error ? error.message : String(error) };
    }
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, plan.length || 1) }, () => worker()));
const summary = {
  total: results.length,
  downloaded: results.filter(x => x?.status === 'DOWNLOADED').length,
  failed: results.filter(x => x?.status === 'FAILED').length,
  skipped: results.filter(x => x?.status === 'SKIPPED').length,
  outputDir: OUTPUT_DIR,
  planPath: PLAN_PATH
};

await writeFile(`${OUTPUT_DIR}/acquisition-results.json`, JSON.stringify({ summary, results }, null, 2));
console.log(JSON.stringify(summary, null, 2));
