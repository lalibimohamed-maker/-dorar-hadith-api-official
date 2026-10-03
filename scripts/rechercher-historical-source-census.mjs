import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const OUT_DIR = 'artifacts/rechercher-historical-source-census';
const OUT = `${OUT_DIR}/sources.json`;
const repo = process.env.GITHUB_REPOSITORY || 'lalibimohamed-maker/-dorar-hadith-api-official';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function branchList() {
  const refs = git(['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin/']);
  return [...new Set(refs.split('\n').filter(Boolean).filter((ref) => !ref.endsWith('/HEAD')))];
}

function trackedFiles(ref) {
  const text = git(['ls-tree', '-r', '--name-only', ref]);
  return text.split('\n').filter(Boolean).filter((path) => {
    if (/^(node_modules|dist|coverage|\.git)\//.test(path)) return false;
    return /(^|\/)(rechercher|source|sources|registry|registries|discovery|catalog|academic|islamic|quran|hadith|fiqh|fatwa|rijal)/i.test(path)
      || /(?:source|registry|discovery|catalog|rechercher)/i.test(path);
  });
}

function fileText(ref, path) {
  try { return git(['show', `${ref}:${path}`]); } catch { return ''; }
}

function extract(ref, path, text) {
  const records = [];
  const urls = text.match(/https?:\/\/[^\s"'<>`\\)\],}]+/g) || [];
  for (const raw of urls) {
    const url = raw.replace(/[.,;:!?]+$/g, '');
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) continue;
      records.push({ url: parsed.href });
    } catch {}
  }

  const json = safeJson(text);
  if (json) {
    const walk = (value, key = '') => {
      if (Array.isArray(value)) return value.forEach((item) => walk(item, key));
      if (!value || typeof value !== 'object') return;
      const url = typeof value.url === 'string' ? value.url : null;
      const name = value.name || value.title || value.label || value.id || null;
      if (url && name) records.push({ url, name: String(name), id: value.id ? String(value.id) : undefined, role: value.role || value.purpose || undefined });
      for (const [childKey, child] of Object.entries(value)) walk(child, childKey);
    };
    walk(json);
  }

  const unique = new Map();
  for (const item of records) {
    const key = String(item.url).toLowerCase();
    if (!unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()].map((item) => ({ ...item, branch: ref.replace(/^origin\//, ''), path }));
}

const refs = branchList();
const byUrl = new Map();
let filesScanned = 0;
for (const ref of refs) {
  for (const path of trackedFiles(ref)) {
    const text = fileText(ref, path);
    if (!text) continue;
    filesScanned += 1;
    for (const record of extract(ref, path, text)) {
      const key = record.url.toLowerCase();
      const existing = byUrl.get(key);
      if (existing) existing.provenance.push({ branch: record.branch, path, id: record.id, name: record.name, role: record.role });
      else byUrl.set(key, { url: record.url, name: record.name, id: record.id, role: record.role, provenance: [{ branch: record.branch, path, id: record.id, name: record.name, role: record.role }] });
    }
  }
}

const sources = [...byUrl.values()].sort((a, b) => a.url.localeCompare(b.url));
await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT, JSON.stringify({
  schema: 'din-allah-encyclopedia/rechercher-historical-source-census/v1',
  generated_at: new Date().toISOString(),
  repository: repo,
  branch_count: refs.length,
  files_scanned: filesScanned,
  unique_urls: sources.length,
  branches: refs.map((ref) => ref.replace(/^origin\//, '')),
  sources,
  policy: {
    purpose: 'Historical union audit: every source URL found in Rechercher-related branch history is retained for review and future discovery.',
    discovery_never_implies_redistribution: true,
    corpus_isolation: true,
    native_protocols_require_verification: true,
    missing_from_master_registry_must_be_promoted_after_review: true
  }
}, null, 2) + '\n', 'utf8');

console.log(`[RECHERCHER HISTORICAL CENSUS] branches=${refs.length} files=${filesScanned} unique_urls=${sources.length}`);
console.log(`[RECHERCHER HISTORICAL CENSUS] output=${OUT}`);
