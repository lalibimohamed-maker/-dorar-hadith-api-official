import fs from 'node:fs';

const registryPath = new URL('../config/free-first-fallback-registry-2026.json', import.meta.url);

export function loadFallbackRegistry() {
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

function scoreCandidate(candidate, status = {}) {
  let score = 0;
  if (status.available === true) score += 1000;
  if (status.healthy === true) score += 500;
  if (status.compatible === true) score += 300;
  if (status.current === true) score += 200;
  if (Number.isFinite(status.qualityScore)) score += Math.max(0, Math.min(100, status.qualityScore));
  if (status.free === true) score += 50;
  if (status.openSource === true) score += 25;
  score -= (status.failureCount ?? 0) * 10;
  score -= (status.latencyMs ?? 0) / 1000;
  return score;
}

export function selectEngine(domain, statuses = {}) {
  const registry = loadFallbackRegistry();
  const definition = registry.domains?.[domain];
  if (!definition) throw new Error(`Unknown fallback domain: ${domain}`);

  const candidates = [definition.primary, ...(definition.fallbacks ?? [])];
  const eligible = candidates.filter((name) => {
    const status = statuses[name] ?? {};
    return (
      status.available === true &&
      status.healthy === true &&
      status.compatible === true &&
      status.free === true &&
      status.blocked !== true
    );
  });

  if (!eligible.length) {
    return {
      selected: null,
      reason: 'no-free-eligible-engine',
      failClosed: true,
      domain
    };
  }

  const ranked = eligible
    .map((name, index) => ({
      name,
      index,
      score: scoreCandidate(name, statuses[name] ?? {})
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const selected = ranked[0];
  return {
    selected: selected.name,
    reason: selected.name === definition.primary ? 'preferred-engine-healthy' : 'fallback-selected',
    failClosed: false,
    domain,
    fallbackDepth: selected.index,
    score: selected.score
  };
}
