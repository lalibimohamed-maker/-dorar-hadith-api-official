import { searchDorar } from "./dorar-client.js";

function normalize(text) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
}

function extractItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.ahadith)) return payload.ahadith;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export async function findHadithLinksForAyah(verseText, { signal, limit = 10 } = {}) {
  const text = String(verseText || "").trim();
  if (!text) return [];

  // Search the official Dorar API using the ayah text. This is a candidate-link
  // stage, not a claim that every result is a سبب نزول or direct interpretation.
  const payload = await searchDorar(text, { signal });
  return extractItems(payload).slice(0, limit).map((item, index) => ({
    id: item.id ?? item.hadith_id ?? `dorar-${index + 1}`,
    relationshipType: "hadith-candidate",
    confidence: "candidate",
    source: "dorar",
    text: item.text ?? item.hadith ?? item.matn ?? null,
    raw: item,
    policy: "Candidate relation only; سبب النزول requires separate source verification."
  }));
}

export function matchAyahText(hadithText, verseText) {
  const hadith = normalize(hadithText);
  const verse = normalize(verseText);
  return Boolean(hadith && verse && (hadith.includes(verse) || verse.includes(hadith)));
}
