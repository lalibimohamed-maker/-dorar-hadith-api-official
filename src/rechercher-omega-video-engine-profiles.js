import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const DEFAULT_PROFILES = fileURLToPath(
  new URL("../config/rechercher-omega-video-engine-profiles-2026.json", import.meta.url),
);

export async function loadVideoEngineProfiles(path = DEFAULT_PROFILES) {
  return JSON.parse(await readFile(path, "utf8"));
}

export function selectVideoEngineProfile({ profiles, engineId, profileId }) {
  if (!profiles || typeof profiles !== "object") {
    throw new Error("video engine profiles are required");
  }
  if (!engineId || !profileId) {
    throw new Error("engineId and profileId are required");
  }

  const engineKey = engineId === "hunyuanvideo-1.5"
    ? "hunyuanvideo15"
    : engineId === "ltx-2"
      ? "ltx2"
      : null;

  if (!engineKey || !profiles[engineKey]) {
    throw new Error("unsupported video engine profile family: " + engineId);
  }

  const profile = (profiles[engineKey].profiles ?? []).find(item => item.id === profileId);
  if (!profile) {
    throw new Error("unknown video engine profile: " + engineId + "/" + profileId);
  }

  return {
    engine_id: engineId,
    profile_id: profile.id,
    loader: profile.loader ?? null,
    model_revision: profiles[engineKey].model_revision,
    storage_repository: profiles[engineKey].storage_repository,
    storage_release_tag: profiles[engineKey].storage_release_tag,
    profile,
    execution_proof: profile.runtime_proof ?? "not_verified",
    selection_policy: "exactly_one_profile_per_generation_job"
  };
}
