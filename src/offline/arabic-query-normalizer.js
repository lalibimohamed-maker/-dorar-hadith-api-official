/**
 * Rechercher Ω — deterministic Arabic query normalization for local search.
 *
 * Retrieval-only layer: canonical Corpus text is never rewritten.
 */
const TASHKEEL = /[\u064B-\u065F\u0670]/gu;
const TATWEEL = /\u0640+/gu;
const ARABIC_SCRIPT = /[\u0600-\u06FF]/u;

const FORM_MAP = Object.freeze([
  ["آ", "ا"],
  ["أ", "ا"],
  ["إ", "ا"],
  ["ٱ", "ا"],
  ["ؤ", "و"],
  ["ئ", "ي"]
]);

function collapseSpaces(text) {
  return String(text ?? "").replace(/\s+/gu, " ").trim();
}

export function normalizeArabicQuery(value) {
  let text = String(value ?? "").normalize("NFKC").normalize("NFC");
  text = text.replace(TATWEEL, "").replace(TASHKEEL, "");
  for (const [from, to] of FORM_MAP) text = text.split(from).join(to);
  return collapseSpaces(text);
}

export function buildArabicQueryVariants(value) {
  const raw = String(value ?? "").normalize("NFC").trim();
  const normalized = normalizeArabicQuery(raw);
  return Object.freeze([...new Set([raw, normalized].filter(Boolean))]);
}

function cleanVariant(value, {
  normalizeLetters = false,
  normalizeMaqsurah = false,
  normalizeTaMarbuta = false
} = {}) {
  let text = String(value ?? "").normalize("NFKC").normalize("NFC");
  text = text.replace(TATWEEL, "").replace(TASHKEEL, "");
  if (normalizeLetters) {
    for (const [from, to] of FORM_MAP) text = text.split(from).join(to);
  }
  if (normalizeMaqsurah) text = text.replace(/ى/g, "ي");
  if (normalizeTaMarbuta) text = text.replace(/ة/g, "ه");
  return collapseSpaces(text);
}

export function createArabicQueryPlan(value = "") {
  const raw = String(value ?? "").trim();
  if (!raw) return Object.freeze([]);

  const candidates = [
    { kind: "original", query: raw },
    { kind: "tatweel_removed", query: raw.replace(TATWEEL, "") },
    { kind: "diacritics_removed", query: cleanVariant(raw) },
    { kind: "controlled_letter_normalization", query: cleanVariant(raw, { normalizeLetters: true }) },
    {
      kind: "maqsurah_yaa_variant",
      query: cleanVariant(raw, { normalizeLetters: true, normalizeMaqsurah: true })
    },
    {
      kind: "controlled_loose_variant",
      query: cleanVariant(raw, {
        normalizeLetters: true,
        normalizeMaqsurah: true,
        normalizeTaMarbuta: true
      })
    }
  ];

  const seen = new Set();
  const plan = [];
  for (const candidate of candidates) {
    const query = collapseSpaces(candidate.query);
    if (!query || seen.has(query)) continue;
    seen.add(query);
    plan.push(Object.freeze({ kind: candidate.kind, query }));
  }
  return Object.freeze(plan);
}

export async function searchWithArabicQueryPlan(searchFn, query, options = {}) {
  if (typeof searchFn !== "function") throw new TypeError("searchFn must be a function");

  const plan = createArabicQueryPlan(query);
  const hits = [];
  const errors = [];
  const seen = new Set();

  for (const variant of plan) {
    try {
      const results = await searchFn(
        variant.query,
        { ...options, query_variant: variant.kind }
      );

      for (const hit of results ?? []) {
        const document = hit?.document ?? hit;
        const stableId = String(
          document?.node_id ??
          document?.id ??
          document?.evidence_id ??
          ""
        );
        const key = stableId || JSON.stringify(document ?? hit);
        if (seen.has(key)) continue;
        seen.add(key);
        hits.push(hit);
      }
    } catch (error) {
      errors.push(Object.freeze({
        variant: variant.kind,
        message: String(error?.message ?? error)
      }));
    }
  }

  return Object.freeze({
    raw_query: String(query ?? ""),
    variants: plan,
    hits: Object.freeze(hits),
    errors: Object.freeze(errors)
  });
}

export function isArabicQuery(value) {
  return ARABIC_SCRIPT.test(String(value ?? ""));
}
