import {
  computeChunkIntegrity,
  computeDistributionIntegrity
} from "./omega-integrity-chain.js";
import { assertVerifiedEd25519ManifestSignature } from "./omega-manifest-signature.js";

const HEX_SHA256 = /^[a-f0-9]{64}$/i;

function requiredString(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new Error(field + " must be a non-empty string");
}

function positiveSafeInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(field + " must be a positive safe integer");
}

function sha256(value, field) {
  if (!HEX_SHA256.test(String(value ?? ""))) throw new Error(field + " must be a SHA-256 hex digest");
}

export function validateOfflineInstallManifest(manifest, {
  trustedPublicKeys = null,
  requireAuthenticatedSignature = false
} = {}) {
  if (!manifest || typeof manifest !== "object") throw new TypeError("offline install manifest must be an object");
  if (manifest.schema_version !== "1.0.0") throw new Error("unsupported offline install manifest version");

  requiredString(manifest.artifact?.model_id, "artifact.model_id");
  requiredString(manifest.artifact?.version, "artifact.version");
  requiredString(manifest.artifact?.revision, "artifact.revision");
  requiredString(manifest.artifact?.license, "artifact.license");
  positiveSafeInteger(manifest.artifact?.total_size_bytes, "artifact.total_size_bytes");
  sha256(manifest.artifact?.total_sha256, "artifact.total_sha256");
  requiredString(manifest.artifact?.signature?.algorithm, "artifact.signature.algorithm");
  requiredString(manifest.artifact?.signature?.public_key_id, "artifact.signature.public_key_id");
  requiredString(manifest.artifact?.signature?.signature_base64, "artifact.signature.signature_base64");

  if (requireAuthenticatedSignature) {
    assertVerifiedEd25519ManifestSignature(manifest, { trustedPublicKeys: trustedPublicKeys ?? {} });
  }

  if (!Array.isArray(manifest.tokenizer?.files) || manifest.tokenizer.files.length === 0) {
    throw new Error("tokenizer.files must not be empty");
  }
  for (const [index, file] of manifest.tokenizer.files.entries()) {
    requiredString(file.name, "tokenizer.files[" + index + "].name");
    positiveSafeInteger(file.bytes, "tokenizer.files[" + index + "].bytes");
    sha256(file.sha256, "tokenizer.files[" + index + "].sha256");
  }
  requiredString(manifest.tokenizer.unicode_test_profile, "tokenizer.unicode_test_profile");

  for (const field of [
    "estimated_peak_ram_bytes",
    "runtime_overhead_bytes",
    "index_peak_ram_bytes",
    "tokenizer_runtime_bytes",
    "concurrent_buffer_bytes",
    "safety_margin_bytes"
  ]) {
    positiveSafeInteger(manifest.runtime_profile?.[field], "runtime_profile." + field);
  }
  if (!Array.isArray(manifest.runtime_profile?.supported_runtimes) ||
      manifest.runtime_profile.supported_runtimes.length === 0) {
    throw new Error("runtime_profile.supported_runtimes must not be empty");
  }
  for (const [name, value] of Object.entries(manifest.runtime_profile?.platform_caps_bytes ?? {})) {
    positiveSafeInteger(value, "runtime_profile.platform_caps_bytes." + name);
  }

  requiredString(manifest.evidence_index?.type, "evidence_index.type");
  sha256(manifest.evidence_index?.index_sha256, "evidence_index.index_sha256");
  if (manifest.evidence_index.content_sha256_field !== "content_sha256") {
    throw new Error("evidence index must expose content_sha256 separately from node_id");
  }
  if (manifest.evidence_index.node_id_field !== "node_id") {
    throw new Error("evidence index node_id field is not explicit");
  }

  requiredString(manifest.distribution?.release_asset, "distribution.release_asset");
  if (!Array.isArray(manifest.distribution.chunks) || manifest.distribution.chunks.length === 0) {
    throw new Error("distribution.chunks must not be empty");
  }
  for (const [index, chunk] of manifest.distribution.chunks.entries()) {
    if (chunk.index !== index) throw new Error("distribution chunk index mismatch at " + index);
    requiredString(chunk.asset, "distribution.chunks[" + index + "].asset");
    positiveSafeInteger(chunk.bytes, "distribution.chunks[" + index + "].bytes");
    sha256(chunk.sha256, "distribution.chunks[" + index + "].sha256");
    if (!Array.isArray(chunk.blocks) || chunk.blocks.length === 0) {
      throw new Error("distribution.chunks[" + index + "].blocks must not be empty");
    }
    let offset = 0;
    for (const [blockIndex, block] of chunk.blocks.entries()) {
      if (block.index !== blockIndex) throw new Error("block index mismatch at chunk " + index);
      if (block.offset !== offset) throw new Error("block offset mismatch at chunk " + index + ", block " + blockIndex);
      positiveSafeInteger(block.bytes, "distribution.chunks[" + index + "].blocks[" + blockIndex + "].bytes");
      sha256(block.sha256, "distribution.chunks[" + index + "].blocks[" + blockIndex + "].sha256");
      if (manifest.distribution?.integrity) {
        sha256(block.rolling_sha256, "distribution.chunks[" + index + "].blocks[" + blockIndex + "].rolling_sha256");
      }
      offset += block.bytes;
    }
    if (offset !== chunk.bytes) throw new Error("block coverage mismatch for chunk " + index);

    if (manifest.distribution?.integrity) {
      sha256(chunk.rolling_root_sha256, "distribution.chunks[" + index + "].rolling_root_sha256");
      sha256(chunk.merkle_root_sha256, "distribution.chunks[" + index + "].merkle_root_sha256");
      const computed = computeChunkIntegrity(chunk.blocks);
      if (computed.rolling_root_sha256 !== String(chunk.rolling_root_sha256).toLowerCase()) {
        throw new Error("chunk rolling root mismatch at " + index);
      }
      if (computed.merkle_root_sha256 !== String(chunk.merkle_root_sha256).toLowerCase()) {
        throw new Error("chunk Merkle root mismatch at " + index);
      }
    }
  }

  if (manifest.distribution?.integrity) {
    requiredString(manifest.distribution.integrity.algorithm, "distribution.integrity.algorithm");
    requiredString(manifest.distribution.integrity.rolling_algorithm, "distribution.integrity.rolling_algorithm");
    requiredString(manifest.distribution.integrity.merkle_algorithm, "distribution.integrity.merkle_algorithm");
    sha256(manifest.distribution.integrity.rolling_root_sha256, "distribution.integrity.rolling_root_sha256");
    sha256(manifest.distribution.integrity.merkle_root_sha256, "distribution.integrity.merkle_root_sha256");
    const computed = computeDistributionIntegrity(manifest.distribution.chunks);
    if (computed.rolling_root_sha256 !== String(manifest.distribution.integrity.rolling_root_sha256).toLowerCase()) {
      throw new Error("distribution rolling root mismatch");
    }
    if (computed.merkle_root_sha256 !== String(manifest.distribution.integrity.merkle_root_sha256).toLowerCase()) {
      throw new Error("distribution Merkle root mismatch");
    }
  }

  if (manifest.distribution?.resume?.supports_http_range !== true ||
      manifest.distribution.resume.requires_content_range_206 !== true) {
    throw new Error("distribution resume policy is not strict HTTP Range");
  }

  if (manifest.verification_policy?.fail_closed !== true ||
      manifest.verification_policy.offline_only_must_never_network !== true ||
      manifest.verification_policy.no_corpus_writes !== true ||
      manifest.verification_policy.no_unverified_weight_loading !== true ||
      manifest.verification_policy.no_git_lfs !== true) {
    throw new Error("verification policy is incomplete");
  }

  return Object.freeze({
    valid: true,
    authenticated_signature: Boolean(requireAuthenticatedSignature),
    cumulative_integrity: Boolean(manifest.distribution?.integrity),
    model_id: manifest.artifact.model_id,
    version: manifest.artifact.version
  });
}

export const INSTALL_MANIFEST_SCHEMA_VERSION = "1.0.0";
