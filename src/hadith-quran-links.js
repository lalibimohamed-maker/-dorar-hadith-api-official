import { searchDorar } from "./dorar-client.js";

function normalizeHadithResult(item) {
  return {
    id: item?.id ?? item?.hadithId ?? null,
    text: item?.hadith ?? item?.text ?? item?.matn ?? null,
    source: item?.book ?? item?.source ?? null,
    grade: item?.grade ?? item?.hukm ?? null,
    url: item?.url ?? null,
    relationshipType: "candidate",
    confidence: "unverified",
    note: "Search relevance is not evidence of a Quranic relationship or a cause of revelation. Verify before promoting this relation."
  };
}

export async function findQuranLinksForHadith(hadithText, { signal } = {}) {
  const query = String(hadithText || "").trim();
  if (!query) return [];
  const data = await searchDorar(query, { signal });
  const items = Array.isArray(data) ? data : (data?.results || data?.hadiths || []);
  return items.map(normalizeHadithResult).filter((item) => item.text);
}

export async function findQuranVerseCandidatesForHadith(hadithText, { signal } = {}) {
  const results = await findQuranLinksForHadith(hadithText, { signal });
  return results.map((item) => ({
    ...item,
    relatedQuran: [],
    relationshipType: "candidate",
    confidence: "unverified"
  }));
}
