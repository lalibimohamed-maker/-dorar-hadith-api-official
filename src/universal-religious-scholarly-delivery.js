const APPROVED_REUSE = new Set(["redistributable", "licensed", "public-domain"]);
const COMPARATIVE = "comparative-critical";

export const CONTENT_SCOPE = Object.freeze({
  IN_SCOPE: "din-allah-religious-scholarly",
  OUT_OF_SCOPE: "general-world-books"
});

export function classifyBookForDelivery({ domain, sourceClass = "approved", rights = {}, quran = false }) {
  if (quran) return Object.freeze({ scope: CONTENT_SCOPE.IN_SCOPE, quranSpecialPolicy: true, sourceClass, rightsStatus: rights.status ?? "unknown" });
  if (domain !== CONTENT_SCOPE.IN_SCOPE) return Object.freeze({ scope: CONTENT_SCOPE.OUT_OF_SCOPE, eligible: false });
  return Object.freeze({
    scope: CONTENT_SCOPE.IN_SCOPE,
    eligible: sourceClass !== "unapproved" && sourceClass !== COMPARATIVE,
    comparativeOnly: sourceClass === COMPARATIVE,
    redistributable: APPROVED_REUSE.has(rights.status),
    rightsStatus: rights.status ?? "unknown"
  });
}
