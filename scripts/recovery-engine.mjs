import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const POLICY_PATH = 'config/auto-recovery-policy-2026.json';
const policy = JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'));

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).replace(/\n$/, '');
const allowed = (path) => policy.allowlist.some((rule) => {
  const prefix = rule.pattern.replace(/\*\*?|\*/g, '');
  return path.startsWith(prefix) && (rule.pattern.endsWith('.yml') ? path.endsWith('.yml') : path.endsWith('.yaml'));
});

export function findCreationCommit(path) {
  return git(['log', '--diff-filter=A', '--format=%H', '--', path]).split('\n').filter(Boolean).at(-1) ?? null;
}

export function readAtRef(ref, path) {
  return git(['show', `${ref}:${path}`]);
}

export function buildRecoveryPlan({ files = [], sourceRef = 'origin/main' } = {}) {
  const plan = [];
  for (const path of files) {
    if (!allowed(path) || policy.forbiddenAutomaticRestore.some((p) => p.endsWith('/**') && path.startsWith(p.slice(0, -3)))) continue;
    let source;
    try {
      source = readAtRef(sourceRef, path);
    } catch {
      continue;
    }
    let creationCommit = null;
    try { creationCommit = findCreationCommit(path); } catch { creationCommit = null; }
    plan.push({
      path,
      sourceRef,
      sourceSha256: sha256(source),
      creationCommit,
      strategy: 'last-known-good-main',
      requiresIndependentReview: policy.autoRestore.requireIndependentReview,
      protectedMainDirectWrite: policy.autoRestore.protectedBranchDirectWrite
    });
  }
  return plan;
}

export function applyRecoveryPlan(plan, { apply = false } = {}) {
  if (!apply) return { applied: false, plan };
  const applied = [];
  for (const item of plan) {
    const source = readAtRef(item.sourceRef, item.path);
    if (sha256(source) !== item.sourceSha256) throw new Error(`source integrity changed for ${item.path}`);
    fs.mkdirSync(item.path.split('/').slice(0, -1).join('/') || '.', { recursive: true });
    fs.writeFileSync(item.path, source);
    applied.push(item.path);
  }
  return { applied: true, files: applied };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = process.argv.slice(2).filter(Boolean);
  const apply = process.env.APPLY_RECOVERY === '1';
  const result = applyRecoveryPlan(buildRecoveryPlan({ files }), { apply });
  console.log(JSON.stringify(result, null, 2));
}
