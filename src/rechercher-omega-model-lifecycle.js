import { assertEngineActivation, normalizeEngineIdentity } from "./rechercher-omega-engine-identity.js";

const ORDER = ["registered","installed","verified","active"];

export function validateLifecycleTransition(from, to) {
  if (from === "blocked") throw new Error("blocked engine cannot transition without explicit re-registration");
  if (to === "blocked") return true;
  const a=ORDER.indexOf(from), b=ORDER.indexOf(to);
  if (a < 0 || b < 0 || b < a) throw new Error(`invalid lifecycle transition: ${from} -> ${to}`);
  if (b-a > 1) throw new Error(`lifecycle transition must be incremental: ${from} -> ${to}`);
  return true;
}

export function prepareEngine(identity, { artifactVerified=false, licenseVerified=false }={}) {
  const normalized=normalizeEngineIdentity(identity);
  if (normalized.activation_state === "active") {
    if (!artifactVerified || !licenseVerified) throw new Error("active engine requires verified artifact and license");
    assertEngineActivation(normalized);
  }
  if (normalized.activation_state === "verified" && !artifactVerified) {
    throw new Error("verified engine requires verified artifact");
  }
  return normalized;
}

export function lifecycleSnapshot(identity, checks={}) {
  const engine=normalizeEngineIdentity(identity);
  const artifactVerified=checks.artifactVerified === true;
  const licenseVerified=checks.licenseVerified === true;
  const runtimeReady=checks.runtimeReady === true;
  let state=engine.activation_state;
  if (state !== "blocked" && artifactVerified && licenseVerified) state="verified";
  if (state === "verified" && runtimeReady) state="active";
  return Object.freeze({ ...engine, activation_state: state });
}
