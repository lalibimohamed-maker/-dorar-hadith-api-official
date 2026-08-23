import { getRegistry } from './source-registry.js';

const VERIFIED_STATES = new Set(['source_verified', 'edition_verified', 'scholar_reviewed']);

export function auditSourceRegistry(registry = getRegistry()) {
  const sources = Array.isArray(registry.sources) ? registry.sources : [];
  const duplicateIds = sources.map(s => s.id).filter((id, i, all) => id && all.indexOf(id) !== i);
  const missingIdentity = sources.filter(s => !s?.id || !s?.nameAr && !s?.title);
  const missingAttribution = sources.filter(s => s?.attributionRequired && !s?.attribution && !s?.publisher && !s?.authorAr && !s?.scholar);
  const unverified = sources.filter(s => !VERIFIED_STATES.has(String(s?.verificationState || '')));
  return {
    total: sources.length,
    unique: new Set(sources.map(s => s.id).filter(Boolean)).size,
    duplicateIds: [...new Set(duplicateIds)],
    missingIdentity: missingIdentity.map(s => s?.id || null),
    missingAttribution: missingAttribution.map(s => s?.id || null),
    verified: sources.length - unverified.length,
    unverified: unverified.length,
    valid: duplicateIds.length === 0 && missingIdentity.length === 0 && missingAttribution.length === 0
  };
}

export function assertSourceRegistryQuality(registry = getRegistry()) {
  const audit = auditSourceRegistry(registry);
  if (!audit.valid) throw new Error(`Source registry quality gate failed: ${JSON.stringify(audit)}`);
  return audit;
}
