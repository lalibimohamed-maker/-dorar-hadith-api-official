import { verifyEvidenceHit } from "./omega-local-bridge.js";

export const OMEGA_CLIENT_MODES = Object.freeze(["auto", "offline_only", "online_only"]);

export function createOmegaClient({
  mode = "auto",
  localEvidenceSearch,
  localGenerate,
  onlineGenerate = null
} = {}) {
  if (!OMEGA_CLIENT_MODES.includes(mode)) throw new TypeError("unsupported mode: " + mode);
  if (typeof localEvidenceSearch !== "function") throw new TypeError("localEvidenceSearch is required");
  if (typeof localGenerate !== "function") throw new TypeError("localGenerate is required");
  if (mode !== "offline_only" && mode !== "online_only" && onlineGenerate !== null && typeof onlineGenerate !== "function") {
    throw new TypeError("onlineGenerate must be a function or null");
  }
  if (mode === "online_only" && typeof onlineGenerate !== "function") {
    throw new TypeError("onlineGenerate is required for online_only");
  }

  return Object.freeze({
    mode,
    async answer(query) {
      if (mode === "online_only") return onlineGenerate({ query, evidence: [] });

      const hits = await localEvidenceSearch(query);
      const verified = [];
      for (const hit of hits ?? []) {
        try {
          verified.push(await verifyEvidenceHit(hit));
        } catch {}
      }

      if (verified.length === 0) {
        if (mode === "auto" && typeof onlineGenerate === "function") {
          return onlineGenerate({ query, evidence: [] });
        }
        return Object.freeze({ status: "NO_EVIDENCE_FOUND", evidence: [] });
      }

      const local = await localGenerate({ query, evidence: verified });
      return Object.freeze({ ...local, evidence: verified });
    }
  });
}
