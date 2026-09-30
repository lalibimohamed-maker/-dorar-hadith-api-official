import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import {
  OMEGA_OFFLINE_DELTA_FORMAT,
  computeEvidenceSnapshotRoot,
  computeOfflineDeltaSha256,
  signOfflineDelta,
  validateOfflineDelta,
  verifyOfflineDeltaSignature
} from "../src/distribution/omega-offline-delta.js";

test("offline delta signs the base/target snapshot contract", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const oldRecord = {
    node_id: "n1",
    content_sha256: "a".repeat(64),
    verification_status: "verified"
  };
  const newRecord = {
    ...oldRecord,
    content_sha256: "b".repeat(64),
    text: "updated"
  };

  const base = computeEvidenceSnapshotRoot([oldRecord]);
  const target = computeEvidenceSnapshotRoot([newRecord]);
  const delta = signOfflineDelta({
    schema_version: "1.0.0",
    format: OMEGA_OFFLINE_DELTA_FORMAT,
    sequence: 2,
    generated_at: "2026-09-30T00:00:00Z",
    base_snapshot_sha256: base,
    target_snapshot_sha256: target,
    operations: [{
      op: "upsert",
      node_id: "n1",
      previous_content_sha256: oldRecord.content_sha256,
      record: newRecord
    }]
  }, { privateKey, publicKeyId: "root-1" });

  assert.equal(validateOfflineDelta(delta).valid, true);
  assert.equal(computeOfflineDeltaSha256(delta), delta.delta_sha256);
  assert.equal(verifyOfflineDeltaSignature(delta, { trustedPublicKeys: { "root-1": publicKey } }), true);
});

test("delta signature invalidates when the target root changes", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const delta = signOfflineDelta({
    schema_version: "1.0.0",
    format: OMEGA_OFFLINE_DELTA_FORMAT,
    sequence: 1,
    generated_at: "2026-09-30T00:00:00Z",
    base_snapshot_sha256: "a".repeat(64),
    target_snapshot_sha256: "b".repeat(64),
    operations: []
  }, { privateKey, publicKeyId: "root-1" });

  delta.target_snapshot_sha256 = "c".repeat(64);
  assert.equal(verifyOfflineDeltaSignature(delta, { trustedPublicKeys: { "root-1": publicKey } }), false);
});

test("delta validation rejects duplicate nodes", () => {
  assert.throws(() => validateOfflineDelta({
    schema_version: "1.0.0",
    format: OMEGA_OFFLINE_DELTA_FORMAT,
    sequence: 1,
    generated_at: "",
    base_snapshot_sha256: "a".repeat(64),
    target_snapshot_sha256: "b".repeat(64),
    operations: [
      { op: "delete", node_id: "n1", previous_content_sha256: null },
      { op: "delete", node_id: "n1", previous_content_sha256: null }
    ]
  }), /OFFLINE_DELTA_DUPLICATE_NODE/);
});
