/**
 * Rechercher Ω — deterministic Arabic query normalization for local search.
 *
 * This is not a scholarly transformation of stored source text. It is only
 * used for retrieval hints. Canonical Corpus text is never rewritten.
 */

const TASHKEEL = /[\u064B-\u065F\u0670]/gu;
const TATWEEL = /\u0640/gu;

const FORM_MAP = new Map([
  ["آ", "ا"],
  ["أ", "ا"],
  ["إ", "ا"],
  ["ٱ", "ا"],
  ["ى", "ي"]
]);

export function normalizeArabicQuery(value) {
  let text = String(value ?? "").normalize("NFKC").normalize("NFC");
  text = text.replace(TATWEEL, "").replace(TASHKEEL, "");
  for (const [from, to] of FORM_MAP) text = text.split(from).join(to);
  return text.replace(/\s+/gu, " ").trim();
}

export function buildArabicQueryVariants(value) {
  const raw = String(value ?? "").normalize("NFC").trim();
  const normalized = normalizeArabicQuery(raw);
  return Object.freeze([...new Set([raw, normalized].filter(Boolean))]);
}
