import { createHash, sign, verify, createPublicKey } from "node:crypto";

const HEX_SHA256 = /^[a-f0-9]{64}$/i;

export const OMEGA_OFFLINE_DELTA_FORMAT = "dinullah/omega-offline-evidence-delta";
export const OMEGA_OFFLINE_DELTA_SCHEMA_VERSION = "1.0.0";
export const OMEGA_OFFLINE_SNAPSHOT_ALGORITHM = "omega-evidence-snapshot-v2";

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

function sha256(value) {
  return createHash("sha256")
    .update(Buffer.from(String(value), "utf8"))
    .digest("hex");
}

function hashParts(parts) {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part);
  return hash.digest("hex");
}

function normalizeRecord(record) {
  return {
    node_id: String(record?.node_id ?? ""),
    content_sha256: String(record?.content_sha256 ?? "").toLowerCase(),
    verification_status: "verified",
    title: String(record?.title ?? ""),
    text: String(record?.text ?? ""),
    citation: String(record?.citation ?? ""),
    source_id: String(record?.source_id ?? record?.sourceId ?? ""),
    language: String(record?.language ?? ""),
    updated_at: String(record?.updated_at ?? "")
  };
}

function hashSnapshotLeaf(record) {
  return hashParts([
    Buffer.from("dinullah:omega:evidence:snapshot-leaf:v2\0", "utf8"),
    Buffer.from(JSON.stringify(canonicalize(normalizeRecord(record))), "utf8")
  ]);
}

function hashSnapshotParent(left, right) {
  return hashParts([
    Buffer.from("dinullah:omega:evidence:snapshot-parent:v2\0", "utf8"),
    Buffer.from(left, "hex"),
    Buffer.from("\0", "utf8"),
    Buffer.from(right, "hex")
  ]);
}

export function computeEvidenceSnapshotRoot(records = []) {
  let level = records
    .map(normalizeRecord)
    .sort((a, b) => a.node_id.localeCompare(b.node_id))
    .map(hashSnapshotLeaf);

  if (level.length === 0) {
    return sha256("dinullah:omega:evidence:snapshot-empty:v2\0");
  }

  while (level.length > 1) {
    const next = [];
    for (let index = 0; index < level.length; index += 2) {
      next.push(hashSnapshotParent(level[index], level[index + 1] ?? level[index]));
    }
    level = next;
  }

  return level[0];
}

export function canonicalizeOfflineDeltaForHash(delta) {
  const rawOperations = [...(delta?.operations ?? [])];
  for (const operation of rawOperations) {
    if (operation?.op !== "upsert" && operation?.op !== "delete") {
      throw new Error("OFFLINE_DELTA_OPERATION_UNSUPPORTED");
    }
  }

  const operations = rawOperations
    .map(operation => operation.op === "upsert"
      ? {
          op: "upsert",
          node_id: String(operation.record?.node_id ?? ""),
          previous_content_sha256: operation.previous_content_sha256 == null
            ? null
            : String(operation.previous_content_sha256).toLowerCase(),
          record: normalizeRecord(operation.record)
        }
      : {
          op: "delete",
          node_id: String(operation.node_id ?? ""),
          previous_content_sha256: operation.previous_content_sha256 == null
            ? null
            : String(operation.previous_content_sha256).toLowerCase()
        })
    .sort((a, b) => a.node_id.localeCompare(b.node_id) || a.op.localeCompare(b.op));

  return {
    schema_version: OMEGA_OFFLINE_DELTA_SCHEMA_VERSION,
    format: OMEGA_OFFLINE_DELTA_FORMAT,
    snapshot_algorithm: OMEGA_OFFLINE_SNAPSHOT_ALGORITHM,
    sequence: Math.max(1, Number(delta?.sequence) || 0),
    generated_at: String(delta?.generated_at ?? ""),
    base_snapshot_sha256: String(delta?.base_snapshot_sha256 ?? "").toLowerCase(),
    target_snapshot_sha256: String(delta?.target_snapshot_sha256 ?? "").toLowerCase(),
    operations
  };
}

export function computeOfflineDeltaSha256(delta) {
  const payload = canonicalizeOfflineDeltaForHash(delta);
  return sha256(JSON.stringify(canonicalize(payload)) + "\n");
}

export function canonicalizeOfflineDeltaForSigning(delta) {
  const payload = canonicalizeOfflineDeltaForHash(delta);
  return JSON.stringify(canonicalize({
    ...payload,
    delta_sha256: String(delta?.delta_sha256 ?? "").toLowerCase(),
    signature: {
      algorithm: String(delta?.signature?.algorithm ?? ""),
      public_key_id: String(delta?.signature?.public_key_id ?? "")
    }
  })) + "\n";
}

export function signOfflineDelta(delta, { privateKey, publicKeyId } = {}) {
  if (!privateKey) throw new TypeError("privateKey is required");
  if (!publicKeyId) throw new TypeError("publicKeyId is required");

  const payload = canonicalizeOfflineDeltaForHash(delta);
  const deltaSha256 = computeOfflineDeltaSha256(delta);
  const unsigned = {
    ...payload,
    delta_sha256: deltaSha256,
    signature: {
      algorithm: "ed25519",
      public_key_id: String(publicKeyId)
    }
  };

  const signature = sign(
    null,
    Buffer.from(JSON.stringify(canonicalize(unsigned)) + "\n", "utf8"),
    privateKey
  );

  return Object.freeze({
    ...unsigned,
    signature: {
      ...unsigned.signature,
      signature_base64: signature.toString("base64")
    }
  });
}

export function verifyOfflineDeltaSignature(delta, { trustedPublicKeys = {} } = {}) {
  const metadata = delta?.signature;
  if (metadata?.algorithm !== "ed25519") return false;

  const keyId = String(metadata.public_key_id ?? "");
  const publicKey = trustedPublicKeys?.[keyId];
  const signatureBase64 = String(metadata.signature_base64 ?? "");
  if (!keyId || !publicKey || !signatureBase64) return false;

  const actualDeltaSha256 = computeOfflineDeltaSha256(delta);
  if (!HEX_SHA256.test(String(delta?.delta_sha256 ?? "")) ||
      actualDeltaSha256 !== String(delta.delta_sha256).toLowerCase()) {
    return false;
  }

  try {
    const signature = Buffer.from(signatureBase64, "base64");
    if (signature.length !== 64) return false;

    return verify(
      null,
      Buffer.from(canonicalizeOfflineDeltaForSigning(delta), "utf8"),
      createPublicKey(publicKey),
      signature
    );
  } catch {
    return false;
  }
}

export function validateOfflineDelta(delta) {
  const payload = canonicalizeOfflineDeltaForHash(delta);

  if (payload.schema_version !== OMEGA_OFFLINE_DELTA_SCHEMA_VERSION ||
      payload.format !== OMEGA_OFFLINE_DELTA_FORMAT ||
      payload.snapshot_algorithm !== OMEGA_OFFLINE_SNAPSHOT_ALGORITHM) {
    throw new Error("OFFLINE_DELTA_SCHEMA_UNSUPPORTED");
  }

  if (!HEX_SHA256.test(payload.base_snapshot_sha256)) {
    throw new Error("OFFLINE_DELTA_BASE_ROOT_INVALID");
  }
  if (!HEX_SHA256.test(payload.target_snapshot_sha256)) {
    throw new Error("OFFLINE_DELTA_TARGET_ROOT_INVALID");
  }
  if (!Array.isArray(payload.operations)) {
    throw new Error("OFFLINE_DELTA_OPERATIONS_INVALID");
  }

  const seen = new Set();
  for (const operation of payload.operations) {
    if (seen.has(operation.node_id)) {
      throw new Error("OFFLINE_DELTA_DUPLICATE_NODE");
    }
    seen.add(operation.node_id);

    if (operation.previous_content_sha256 !== null &&
        !HEX_SHA256.test(operation.previous_content_sha256)) {
      throw new Error("OFFLINE_DELTA_PREVIOUS_HASH_INVALID");
    }

    if (operation.op === "delete") continue;
    if (operation.op !== "upsert") {
      throw new Error("OFFLINE_DELTA_OPERATION_UNSUPPORTED");
    }

    if (!operation.record.node_id ||
        !operation.record.text ||
        !HEX_SHA256.test(operation.record.content_sha256) ||
        operation.record.verification_status !== "verified") {
      throw new Error("OFFLINE_DELTA_RECORD_INVALID");
    }
  }

  return Object.freeze({
    valid: true,
    operations: payload.operations.length,
    snapshot_algorithm: OMEGA_OFFLINE_SNAPSHOT_ALGORITHM
  });
}
