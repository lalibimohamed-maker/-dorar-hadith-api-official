const VERIFIED_TYPES = new Set([
  "revelation-cause",
  "revelation-context",
  "tafsir-evidence",
  "hadith-linked",
  "sirah-event-linked",
  "scholar-testimony"
]);

const CONFIDENCE_RANK = {
  verified: 3,
  supported: 2,
  unverified: 1
};

export function verifyKnowledgeLink(link) {
  const item = { ...(link || {}) };
  const type = item.relationshipType || "candidate";
  const hasSource = Boolean(item.source || item.sourceId || item.url || item.citation);
  const explicitlyVerified = item.verified === true;

  if (type === "candidate" || type === "inference") {
    return {
      ...item,
      verified: false,
      confidence: "unverified",
      verification: "candidate"
    };
  }

  if (type === "revelation-cause" && (!hasSource || !explicitlyVerified)) {
    return {
      ...item,
      verified: false,
      confidence: "unverified",
      verification: "requires-source-verification",
      warning: "A cause of revelation must have an identifiable supporting source."
    };
  }

  if (VERIFIED_TYPES.has(type) && hasSource && explicitlyVerified) {
    return {
      ...item,
      verified: true,
      confidence: "verified",
      verification: "source-verified"
    };
  }

  return {
    ...item,
    verified: false,
    confidence: "unverified",
    verification: "requires-source-verification"
  };
}

export function verifyKnowledgeLinks(links = []) {
  return links.map(verifyKnowledgeLink);
}

export function promoteVerifiedLinks(links = []) {
  return verifyKnowledgeLinks(links).filter((item) => item.verified === true);
}

export function rankKnowledgeLinks(links = []) {
  return verifyKnowledgeLinks(links).sort((a, b) => {
    const rank = (CONFIDENCE_RANK[b.confidence] || 0) - (CONFIDENCE_RANK[a.confidence] || 0);
    if (rank) return rank;
    return String(a.relationshipType || "").localeCompare(String(b.relationshipType || ""));
  });
}
