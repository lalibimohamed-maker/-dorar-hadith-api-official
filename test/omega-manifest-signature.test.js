import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  canonicalizeManifestForSigning,
  verifyEd25519ManifestSignature,
  assertVerifiedEd25519ManifestSignature
} from "../src/distribution/omega-manifest-signature.js";

test("Ed25519 manifest verification fails closed without a trusted key", () => {
  const manifest = {
    artifact: {
      model_id: "example/model",
      version: "1",
      signature: {
        algorithm: "ed25519",
        public_key_id: "root-1",
        signature_base64: ""
      }
    }
  };
  assert.equal(verifyEd25519ManifestSignature(manifest).verified, false);
});

test("Ed25519 signature is verified over canonical manifest bytes excluding signature bytes", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const manifest = {
    schema_version: "1.0.0",
    artifact: {
      model_id: "example/model",
      version: "1",
      signature: {
        algorithm: "ed25519",
        public_key_id: "root-1",
        signature_base64: ""
      }
    },
    distribution: {
      integrity: { merkle_root_sha256: "a".repeat(64) }
    }
  };

  const signature = sign(
    null,
    Buffer.from(canonicalizeManifestForSigning(manifest), "utf8"),
    privateKey
  );
  const signed = structuredClone(manifest);
  signed.artifact.signature.signature_base64 = signature.toString("base64");

  const result = verifyEd25519ManifestSignature(signed, {
    trustedPublicKeys: { "root-1": publicKey }
  });

  assert.equal(result.verified, true);
  assert.doesNotThrow(() => assertVerifiedEd25519ManifestSignature(signed, {
    trustedPublicKeys: { "root-1": publicKey }
  }));

  signed.distribution.integrity.merkle_root_sha256 = "b".repeat(64);
  assert.equal(verifyEd25519ManifestSignature(signed, {
    trustedPublicKeys: { "root-1": publicKey }
  }).verified, false);
});
