import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { validateOfflineInstallManifest } from "../src/distribution/omega-install-manifest.js";
import { verifyTokenizerFiles, assertExactUnicodeRoundTrip } from "../src/distribution/omega-tokenizer-integrity.js";
import { computeEffectiveMemoryCap, evaluateMemoryAdmission } from "../src/distribution/omega-memory-admission.js";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

test("offline installation manifest requires separated node_id and content_sha256", () => {
  const manifest = {
    schema_version: "1.0.0",
    artifact: {
      model_id: "example/model",
      version: "1",
      revision: "rev",
      license: "Apache-2.0",
      total_size_bytes: 1,
      total_sha256: "0".repeat(64),
      signature: {
        algorithm: "ed25519",
        public_key_id: "omega-release-root-v1",
        signature_base64: "AA=="
      }
    },
    tokenizer: {
      files: [{ name: "tokenizer.json", bytes: 1, sha256: "0".repeat(64) }],
      unicode_test_profile: "quran-canonical-roundtrip-v1"
    },
    runtime_profile: {
      estimated_peak_ram_bytes: 1,
      runtime_overhead_bytes: 1,
      index_peak_ram_bytes: 1,
      tokenizer_runtime_bytes: 1,
      concurrent_buffer_bytes: 1,
      safety_margin_bytes: 1,
      supported_runtimes: ["onnxruntime-web"],
      platform_caps_bytes: {}
    },
    evidence_index: {
      type: "orama-text",
      index_sha256: "0".repeat(64),
      content_sha256_field: "content_sha256",
      node_id_field: "node_id"
    },
    distribution: {
      release_asset: "model.part-00",
      chunks: [{
        index: 0,
        asset: "model.part-00",
        bytes: 1,
        sha256: "0".repeat(64),
        blocks: [{ index: 0, offset: 0, bytes: 1, sha256: "0".repeat(64) }]
      }],
      resume: {
        supports_http_range: true,
        requires_content_range_206: true
      }
    },
    verification_policy: {
      fail_closed: true,
      offline_only_must_never_network: true,
      no_corpus_writes: true,
      no_unverified_weight_loading: true,
      no_git_lfs: true
    }
  };

  assert.equal(validateOfflineInstallManifest(manifest).valid, true);

  const bad = structuredClone(manifest);
  bad.evidence_index.content_sha256_field = "node_id";
  assert.throws(() => validateOfflineInstallManifest(bad), /content_sha256/);
});

test("tokenizer bytes are hash-verified independently from tokenizer semantics", async () => {
  const bytes = new TextEncoder().encode("{\"vocab\":[]}");
  const expected = [{ name: "tokenizer.json", sha256: sha256(bytes) }];

  assert.equal(await verifyTokenizerFiles([{ name: "tokenizer.json", bytes }], expected), true);
  assert.equal(
    await verifyTokenizerFiles([{ name: "tokenizer.json", bytes: new TextEncoder().encode("mutated") }], expected),
    false
  );

  const tokenizer = {
    encode: text => Array.from(text, char => char.codePointAt(0)),
    decode: ids => String.fromCodePoint(...ids)
  };

  assert.equal(
    await assertExactUnicodeRoundTrip(tokenizer, [{ input: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ" }]),
    true
  );
});

test("memory admission uses known process caps and all runtime overhead", () => {
  const cap = computeEffectiveMemoryCap({
    deviceMemoryGb: 8,
    platformProcessCapBytes: 2 * 1024 ** 3,
    nativeWebViewCapBytes: 3 * 1024 ** 3
  });
  assert.equal(cap, 2 * 1024 ** 3);

  const result = evaluateMemoryAdmission({
    effectiveCapBytes: 1000,
    estimatedPeakRamBytes: 600,
    runtimeOverheadBytes: 100,
    indexPeakRamBytes: 50,
    tokenizerRuntimeBytes: 50,
    concurrentBufferBytes: 50,
    safetyMarginBytes: 150
  });

  assert.equal(result.required_bytes, 1000);
  assert.equal(result.status, "fit");
});
