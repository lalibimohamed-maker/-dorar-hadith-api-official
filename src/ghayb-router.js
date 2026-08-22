import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize } from './encyclopedia-search.js';
import { findGhaybEvidence } from './corpus_repository.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'config', 'ghayb-knowledge-domains-2026.json');
let cache;
function loadCatalog() { if (!cache) cache = JSON.parse(fs.readFileSync(FILE, 'utf8')); return cache; }
function matches(text, alias) { const q = normalize(text); const a = normalize(alias); return q === a || q.includes(a) || a.includes(q); }

export function resolveGhaybDomain(text) {
  const catalog = loadCatalog();
  let best = null;
  for (const domain of catalog.domains || []) for (const alias of domain.aliases || []) {
    if (!matches(text, alias)) continue;
    const score = normalize(text) === normalize(alias) ? 100 : Math.max(60, Math.min(95, alias.length));
    if (!best || score > best.score) best = { domain, matchedAlias: alias, score };
  }
  if (!best) return null;
  return {
    id: `ghayb:${best.domain.id}`, type: 'ghayb-domain', domain: 'aqidah', ghaybDomain: best.domain.id,
    title_ar: best.domain.title_ar, matchedAlias: best.matchedAlias, score: best.score,
    creedSensitive: Boolean(best.domain.creedSensitive), evidencePolicy: catalog.evidencePolicy,
    researchFamily: catalog.researchFamilies?.[best.domain.id] || catalog.researchFamilies?.general || [],
    evidence: findGhaybEvidence(best.domain.id)
  };
}

export function buildGhaybResearchPlan(text, options = {}) {
  const resolved = resolveGhaybDomain(text);
  if (!resolved) return null;
  return {
    query: text, language: options.language || 'ar', concept: resolved,
    stages: ['resolve-canonical-concept','retrieve-quran','retrieve-authenticated-sunnah','retrieve-sound-early-reports','retrieve-attributed-scholarly-works','verify-citations-and-report-grading','separate-fact-from-disputed-report','answer-in-query-language'],
    evidence: resolved.evidence || [],
    rules: {
      citeEveryClaim: true, showSourceLocator: true, showHadithGradeWhenAvailable: true,
      labelScholarOpinions: true, doNotPresentUnknownAsFact: true,
      comparativeCreedOffByDefault: !options.comparative
    }
  };
}

export function listGhaybDomains() { return (loadCatalog().domains || []).map(({ id, title_ar, aliases, creedSensitive }) => ({ id, title_ar, aliases, creedSensitive: Boolean(creedSensitive) })); }
