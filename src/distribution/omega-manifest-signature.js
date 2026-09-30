import { createPublicKey, verify as verifySignature } from "node:crypto";

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .filter(key => value[key] !== undefined)
        .sort()
        .map(key => [key, canonicalize(value[key])])
    );
  }
  return value;
}

export function canonicalizeManifestForSigning(manifest) {
  if (!manifest || typeof manifest !== "object") throw new TypeError("manifest must be an object");
  const copy = structuredClone(manifest);
  if (copy.artifact?.signature && typeof copy.artifact.signature === "object") {
    delete copy.artifact.signature.signature_base64;
  }
  return JSON.stringify(canonicalize(copy)) + "\n";
}

export function verifyEd25519ManifestSignature(manifest, {
  trustedPublicKeys = {}
} = {}) {
  const metadata = manifest?.artifact?.signature;
  if (metadata?.algorithm !== "ed25519") {
    return Object.freeze({ verified: false, reason: "SIGNATURE_ALGORITHM_UNSUPPORTED" });
  }

  const keyId = String(metadata.public_key_id ?? "");
  const signatureBase64 = String(metadata.signature_base64 ?? "");
  const publicKey = trustedPublicKeys?.[keyId];
  if (!keyId || !publicKey) {
    return Object.freeze({ verified: false, reason: "TRUSTED_PUBLIC_KEY_MISSING", public_key_id: keyId || null });
  }

  let signature;
  try {
    signature = Buffer.from(signatureBase64, "base64");
    if (signature.length !== 64) throw new Error("invalid Ed25519 signature length");
  } catch {
    return Object.freeze({ verified: false, reason: "SIGNATURE_ENCODING_INVALID", public_key_id: keyId });
  }

  try {
    const keyObject = createPublicKey(publicKey);
    const verified = verifySignature(
      null,
      Buffer.from(canonicalizeManifestForSigning(manifest), "utf8"),
      keyObject,
      signature
    );
    return Object.freeze({
      verified,
      reason: verified ? "SIGNATURE_VERIFIED" : "SIGNATURE_INVALID",
      public_key_id: keyId
    });
  } catch {
    return Object.freeze({ verified: false, reason: "SIGNATURE_VERIFICATION_ERROR", public_key_id: keyId });
  }
}

export function assertVerifiedEd25519ManifestSignature(manifest, options = {}) {
  const result = verifyEd25519ManifestSignature(manifest, options);
  if (!result.verified) {
    throw new Error(result.reason + (result.public_key_id ? ":" + result.public_key_id : ""));
  }
  return result;
}
