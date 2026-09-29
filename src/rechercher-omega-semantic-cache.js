import { createHash } from "node:crypto";

function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + stable(value[k])).join(",") + "}";
}

function digest(value) {
  return createHash("sha256").update(stable(value), "utf8").digest("hex");
}

export const DEFAULT_CACHE_TTLS_MS = Object.freeze({
  scholarly_answer: 15 * 60 * 1000,
  evidence_synthesis: 15 * 60 * 1000,
  translation_evidence: 30 * 60 * 1000,
  text_to_image: 60 * 60 * 1000,
  image_to_video: 60 * 60 * 1000,
  text_to_video: 60 * 60 * 1000,
  speech_to_text: 10 * 60 * 1000,
  text_to_speech: 30 * 60 * 1000
});

export function buildSemanticCacheKey({
  task,
  model,
  modelRevision = "unknown",
  prompt = "",
  evidence = [],
  generationConfig = {},
  language = "ar"
} = {}) {
  if (!task) throw new TypeError("task is required");
  return "omega-cache-" + digest({
    task,
    model: model ?? "unknown",
    modelRevision,
    prompt,
    evidence: evidence.map((item, index) => ({
      source_id: typeof item === "string" ? item : (item?.source_id ?? item?.id ?? `source-${index + 1}`),
      content_hash: digest(typeof item === "string" ? item : (item?.text ?? item?.excerpt ?? item?.content ?? "")),
      rights: typeof item === "string" ? null : (item?.rights ?? null),
      verification: typeof item === "string" ? null : (item?.verification ?? null)
    })),
    generationConfig,
    language
  });
}

export function createCacheEntry({
  key,
  outputRef = null,
  outputSha256 = null,
  provenanceId = null,
  ttlMs = null,
  createdAt = Date.now()
} = {}) {
  if (!key) throw new TypeError("cache key is required");
  return {
    schema_version: "1.0.0",
    key,
    output_ref: outputRef,
    output_sha256: outputSha256,
    provenance_id: provenanceId,
    created_at: createdAt,
    expires_at: ttlMs == null ? null : createdAt + Math.max(0, Number(ttlMs)),
    privacy: {
      raw_prompt_stored: false,
      raw_evidence_stored: false,
      raw_user_query_stored: false
    }
  };
}

export function isCacheReusable(entry, key, now = Date.now()) {
  if (!entry || entry.key !== key) return false;
  if (!entry.output_ref && !entry.output_sha256) return false;
  return entry.expires_at == null || now < entry.expires_at;
}

export class MemorySemanticCache {
  constructor({ maxEntries = 512 } = {}) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new RangeError("maxEntries must be a positive integer");
    this.maxEntries = maxEntries;
    this.entries = new Map();
  }
  get(key, now = Date.now()) {
    const entry = this.entries.get(key);
    if (!isCacheReusable(entry, key, now)) {
      this.entries.delete(key);
      return null;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry;
  }
  set(entry) {
    if (!entry?.key) throw new TypeError("cache entry with key is required");
    this.entries.delete(entry.key);
    this.entries.set(entry.key, entry);
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value);
    return entry;
  }
  clear() { this.entries.clear(); }
}
