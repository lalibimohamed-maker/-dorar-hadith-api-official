import fs from 'node:fs';

const registryPath = new URL('../config/free-first-fallback-registry-2026.json', import.meta.url);

export function loadFallbackRegistry() {
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

function clampScore(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}

function scoreCandidate(status = {}) {
  let score = 0;
  if (status.available === true) score += 1000;
  if (status.healthy === true) score += 500;
  if (status.compatible === true) score += 300;
  if (status.current === true) score += 200;
  score += clampScore(status.capabilityScore);
  score += clampScore(status.qualityScore);
  if (status.free === true) score += 50;
  if (status.openSource === true) score += 25;
  score += clampScore(status.freshnessScore) / 10;
  score -= Math.max(0, Number(status.failureCount) || 0) * 10;
  score -= Math.max(0, Number(status.latencyMs) || 0) / 1000;
  return score;
}

function eligibilityFailure(status = {}) {
  if (status.blocked === true) return 'blocked';
  if (status.free !== true) return 'not-free';
  if (status.available !== true) return 'unavailable';
  if (status.healthy !== true) return 'unhealthy';
  if (status.compatible !== true) return 'incompatible';
  if (status.current !== true) return 'materially-outdated';
  return null;
}

function assuranceCompatible(primaryStatus = {}, candidateStatus = {}) {
  const primary = Number.isFinite(primaryStatus.assuranceScore)
    ? primaryStatus.assuranceScore
    : null;
  const candidate = Number.isFinite(candidateStatus.assuranceScore)
    ? candidateStatus.assuranceScore
    : null;
  return primary === null || candidate === null || candidate >= primary;
}

function evidenceFor(name, status = {}, selectionCriteria = []) {
  return {
    engine: name,
    version: status.version ?? status.versionReference ?? null,
    capabilityScore: Number.isFinite(status.capabilityScore) ? status.capabilityScore : null,
    qualityScore: Number.isFinite(status.qualityScore) ? status.qualityScore : null,
    freshnessScore: Number.isFinite(status.freshnessScore) ? status.freshnessScore : null,
    assuranceScore: Number.isFinite(status.assuranceScore) ? status.assuranceScore : null,
    securityAssurance: status.securityAssurance ?? null,
    scientificAssurance: status.scientificAssurance ?? null,
    selectionCriteria
  };
}

export function selectEngine(domain, statuses = {}, options = {}) {
  const registry = loadFallbackRegistry();
  const definition = registry.domains?.[domain];
  if (!definition) throw new Error(`Unknown fallback domain: ${domain}`);

  const candidates = [definition.primary, ...(definition.fallbacks ?? [])];
  const primaryStatus = statuses[definition.primary] ?? {};
  const selectionCriteria = [
    'free',
    'available',
    'healthy',
    'compatible',
    'current',
    'capability',
    'quality',
    'freshness',
    'assurance'
  ];

  const eligible = candidates.filter((name) => {
    const status = statuses[name] ?? {};
    const failure = eligibilityFailure(status);
    if (failure) return false;
    if (!assuranceCompatible(primaryStatus, status)) return false;
    return true;
  });

  if (!eligible.length) {
    return {
      selected: null,
      reason: 'no-free-eligible-engine',
      failClosed: true,
      domain,
      primary: definition.primary,
      primaryStatus,
      fallbackDepth: null,
      reasonForFallback: eligibilityFailure(primaryStatus),
      evidence: []
    };
  }

  const ranked = eligible
    .map((name) => ({
      name,
      index: candidates.indexOf(name),
      score: scoreCandidate(statuses[name] ?? {})
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const selected = ranked[0];
  const fallbackSelected = selected.name !== definition.primary;
  const primaryFailure = eligibilityFailure(primaryStatus);

  return {
    selected: selected.name,
    reason: fallbackSelected ? 'fallback-selected' : 'preferred-engine-healthy',
    reasonForFallback: fallbackSelected ? (primaryFailure || 'preferred-engine-lower-evidence') : null,
    failClosed: false,
    domain,
    primary: definition.primary,
    primaryStatus,
    fallbackDepth: selected.index,
    score: selected.score,
    evidence: eligible.map((name) => evidenceFor(name, statuses[name], selectionCriteria)),
    automaticScholarlyPromotionAllowed: false,
    scholarlyPromotionGates: ['provenance', 'rights', 'evidence', 'source-identity', 'protected-review-validation'],
    recheckPrimaryOnNextCycle: true,
    restorePrimaryWhenHealthy: true,
    evaluatedAt: options.now ?? new Date().toISOString()
  };
}

export function evaluateFallbackCycle(domain, statuses = {}, options = {}) {
  const result = selectEngine(domain, statuses, options);
  return {
    ...result,
    cycle: {
      primaryRetested: true,
      selectedEngine: result.selected,
      selectedVersion: result.selected ? (statuses[result.selected]?.version ?? statuses[result.selected]?.versionReference ?? null) : null,
      fallbackUsed: Boolean(result.selected && result.selected !== result.primary),
      fallbackReason: result.reasonForFallback,
      evidence: result.evidence,
      evaluatedAt: result.evaluatedAt
    }
  };
}
