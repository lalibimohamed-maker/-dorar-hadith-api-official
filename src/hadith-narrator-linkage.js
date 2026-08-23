export function linkHadithNarrators(hadith = {}, narratorRecords = []) {
  const ids = Array.isArray(hadith.chain) ? hadith.chain : [];
  const byId = new Map(narratorRecords.map((r) => [r.narratorId, r]));
  return ids.map((narratorId, position) => ({ position: position + 1, narratorId, narrator: byId.get(narratorId) || null, resolved: byId.has(narratorId) }));
}

export function unresolvedNarrators(hadith, narratorRecords) {
  return linkHadithNarrators(hadith, narratorRecords).filter((x) => !x.resolved);
}
