const HEX_SHA256 = /^[a-f0-9]{64}$/i;

export async function sha256Text(value) {
  const data = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyEvidenceHit(hit, { expectedStatus = "verified" } = {}) {
  const document = hit?.document ?? hit;
  if (!document || typeof document !== "object") throw new Error("EVIDENCE_HIT_INVALID");
  if (typeof document.node_id !== "string" || !document.node_id) throw new Error("EVIDENCE_NODE_ID_MISSING");
  if (!HEX_SHA256.test(String(document.content_sha256 ?? ""))) throw new Error("EVIDENCE_CONTENT_HASH_MISSING");
  if (String(document.verification_status ?? "") !== expectedStatus) throw new Error("EVIDENCE_NOT_VERIFIED");
  if (!String(document.citation ?? "").trim()) throw new Error("EVIDENCE_CITATION_MISSING");
  if (typeof document.text !== "string") throw new Error("EVIDENCE_TEXT_MISSING");

  const actual = await sha256Text(document.text);
  if (actual.toLowerCase() !== String(document.content_sha256).toLowerCase()) {
    throw new Error("EVIDENCE_CONTENT_HASH_MISMATCH");
  }

  return Object.freeze({
    node_id: document.node_id,
    content_sha256: document.content_sha256.toLowerCase(),
    citation: document.citation,
    text: document.text
  });
}
