/**
 * Rechercher Ω — curated Hugging Face Space registry.
 *
 * Spaces are references for architecture/capability discovery. They are not
 * trusted scholarly sources, automatic dependencies, or executable backends.
 */

import { readFile } from "node:fs/promises";

const DEFAULT_REGISTRY = new URL("../config/rechercher-omega-space-registry.json", import.meta.url);

export async function loadOmegaSpaceRegistry(url = DEFAULT_REGISTRY) {
  return JSON.parse(await readFile(url, "utf8"));
}

export function selectOmegaSpaceReferences({
  registry,
  capabilities = [],
  includePaused = false
}) {
  const wanted = new Set(capabilities);
  return registry.spaces
    .filter(space => includePaused || space.status !== "verified_paused")
    .filter(space => wanted.size === 0 || space.capabilities.some(capability => wanted.has(capability)))
    .map(space => ({
      id: space.id,
      space_id: space.space_id,
      url: space.url,
      capabilities: [...space.capabilities],
      status: space.status,
      use: space.use,
      license_review: space.license_review
    }));
}

export function buildOmegaSpacePlan({ registry, capabilities = [] }) {
  const references = selectOmegaSpaceReferences({ registry, capabilities });
  return {
    status: references.length ? "reference_available" : "no_reference",
    capabilities: [...capabilities],
    references,
    executable: false,
    persistent_mirror_allowed: false,
    corpus_write_allowed: false,
    generated_media_is_evidence: false
  };
}

export function assertOmegaSpaceBoundary(plan) {
  if (plan.executable) {
    throw new Error("Rechercher Ω Space boundary violation: Spaces are reference-only");
  }
  if (plan.persistent_mirror_allowed) {
    throw new Error("Rechercher Ω Space boundary violation: Space mirroring requires explicit license clearance");
  }
  if (plan.corpus_write_allowed) {
    throw new Error("Rechercher Ω Space boundary violation: Corpus writes are forbidden");
  }
  if (plan.generated_media_is_evidence) {
    throw new Error("Rechercher Ω Space boundary violation: generated media cannot be evidence");
  }
  return true;
}
