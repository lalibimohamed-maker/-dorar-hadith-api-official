/**
 * Rechercher Ω — Offline & Local-First governed engine.
 *
 * user -> local search -> verified local evidence -> local inference
 *      -> strict Evidence Gate -> Unsupported Claim Gate -> output
 *
 * Online execution is an explicit alternative/fallback, never a hidden
 * dependency of offline mode.
 */

import { verifyAgentAnswer } from "../rechercher-omega-answer-verifier.js";
import { detectOfflineRuntimeProfile, evaluateOfflineModelFit } from "./offline-runtime-profile.js";

const MODES = new Set(["auto", "offline_only", "online_only"]);

function sourceId(item) {
  return item?.sourceId ?? item?.source_id ?? item?.id ?? item?.hadith_id ?? item?.node_id ?? null;
}

function citation(item) {
  return item?.citation ?? item?.provenance?.citation ?? null;
}

function buildCitations(evidence) {
  return evidence
    .map(item => {
      const source = sourceId(item);
      const cite = citation(item);
      if (!source || !cite) return null;
      return {
        sourceId: source,
        citation: cite,
        ...(item?.text_hash ? { text_hash: item.text_hash } : {}),
        ...(item?.sha256 ? { text_hash: item.sha256 } : {})
      };
    })
    .filter(Boolean);
}

function exactFallback(evidence) {
  return evidence.find(item => typeof item?.text === "string" && item.text)
    ?? evidence.find(item => typeof item?.text_raw === "string" && item.text_raw)
    ?? null;
}

export class OfflineIslamicAIEngine {
  constructor({
    mode = "auto",
    localSearch,
    localGenerator,
    onlineRunner = null,
    capabilityDetector = detectOfflineRuntimeProfile,
    modelArtifact = null
  } = {}) {
    if (!MODES.has(mode)) throw new TypeError("unsupported offline engine mode");
    if (mode !== "online_only" &&
        (!localSearch || typeof localSearch.searchLocal !== "function")) {
      throw new TypeError("localSearch.searchLocal is required unless mode=online_only");
    }
    if (mode !== "online_only" &&
        (!localGenerator || typeof localGenerator.generate !== "function")) {
      throw new TypeError("localGenerator.generate is required unless mode=online_only");
    }

    this.mode = mode;
    this.localSearch = localSearch;
    this.localGenerator = localGenerator;
    this.onlineRunner = onlineRunner;
    this.capabilityDetector = capabilityDetector;
    this.modelArtifact = modelArtifact;
    this.profile = null;
    this.localReady = false;
    this.localAvailable =
      typeof this.localSearch?.searchLocal === "function" &&
      typeof this.localGenerator?.generate === "function";
  }

  async init() {
    this.profile = await this.capabilityDetector();
    if (this.mode === "online_only") {
      this.localReady = false;
      this.fit = Object.freeze({ status: "disabled", reason: "online_only" });
      return this.profile;
    }

    if (!this.localAvailable) {
      this.fit = Object.freeze({
        status: "unavailable",
        reason: "local_runtime_not_configured"
      });
      if (this.mode === "offline_only") {
        throw new Error("OFFLINE_MODEL_NOT_READY: local runtime is not configured");
      }
      return this.profile;
    }

    const fit = evaluateOfflineModelFit({
      profile: this.profile,
      artifact: this.modelArtifact
    });

    this.localReady = fit.status === "fit" || fit.status === "cpu_fallback";
    this.fit = fit;

    if (this.mode === "offline_only" && !this.localReady) {
      throw new Error("OFFLINE_MODEL_NOT_READY: " + fit.reason);
    }

    return this.profile;
  }

  async executeTurn(userQuery, { claimProvenance = [], searchOptions = {}, generationOptions = {} } = {}) {
    const query = String(userQuery ?? "").trim();
    if (!query) throw new TypeError("offline query is required");
    if (!this.profile) await this.init();

    if (this.mode === "online_only") {
      if (typeof this.onlineRunner !== "function") {
        throw new Error("ONLINE_RUNNER_NOT_CONFIGURED");
      }
      return { ...(await this.onlineRunner(query)), mode: "online" };
    }

    if (this.localReady) {
      try {
        return await this.executeOfflineTurn(query, {
          claimProvenance,
          searchOptions,
          generationOptions
        });
      } catch (error) {
        if (this.mode === "offline_only" || typeof this.onlineRunner !== "function") {
          throw error;
        }
      }
    }

    if (typeof this.onlineRunner === "function") {
      return {
        ...(await this.onlineRunner(query)),
        mode: "online-fallback",
        offline_reason: this.fit?.reason ?? "local_runtime_unavailable"
      };
    }

    throw new Error("NO_EXECUTION_PATH: local and online runners are unavailable");
  }

  async executeOfflineTurn(query, {
    claimProvenance = [],
    searchOptions = {},
    generationOptions = {}
  } = {}) {
    const nodes = await this.localSearch.searchLocal(query, {
      limit: searchOptions.limit ?? 3,
      ...searchOptions
    });

    if (!Array.isArray(nodes) || nodes.length === 0) {
      throw new Error("NO_EVIDENCE_FOUND: local evidence index returned no verified nodes");
    }

    const evidence = nodes.filter(item =>
      (item?.verification_status ?? item?.verification) === "verified" &&
      (item?.text ?? item?.text_raw)
    );

    if (evidence.length === 0) {
      throw new Error("NO_EVIDENCE_FOUND: local evidence is not verified");
    }

    const generated = await this.localGenerator.generate({
      query,
      evidence,
      ...generationOptions
    });

    const verification = verifyAgentAnswer({
      answer: generated,
      evidence,
      citations: buildCitations(evidence),
      claimProvenance
    });

    if (!verification.verified) {
      const fallback = exactFallback(evidence);
      return {
        output: fallback?.text ?? fallback?.text_raw ?? null,
        provenance: fallback?.provenance ?? null,
        verification,
        secured: true,
        mode: "offline-fallback",
        corpus_write_allowed: false,
        generated_media_is_evidence: false
      };
    }

    const primary = evidence[0];
    return {
      output: generated,
      provenance: primary?.provenance ?? null,
      verification,
      secured: true,
      mode: "offline-pure",
      corpus_write_allowed: false,
      generated_media_is_evidence: false
    };
  }

  async dispose() {
    this.localGenerator?.dispose?.();
    this.profile = null;
    this.localReady = false;
  }
}
