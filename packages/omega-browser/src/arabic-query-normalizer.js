const TASHKEEL = /[\u064B-\u065F\u0670]/gu;
const TATWEEL = /\u0640+/gu;

function collapseSpaces(value) {
  return String(value ?? "").replace(/\s+/gu, " ").trim();
}

const FORM_MAP = Object.freeze([
  ["آ", "ا"], ["أ", "ا"], ["إ", "ا"], ["ٱ", "ا"],
  ["ؤ", "و"], ["ئ", "ي"]
]);

function normalizeArabicQuery(value) {
  let text = String(value ?? "").normalize("NFKC").normalize("NFC");
  text = text.replace(TATWEEL, "").replace(TASHKEEL, "");
  for (const [from, to] of FORM_MAP) text = text.split(from).join(to);
  return collapseSpaces(text);
}

export function createArabicQueryPlan(value = "") {
  const raw = String(value ?? "").trim();
  if (!raw) return Object.freeze([]);

  const candidates = [
    ["original", raw],
    ["tatweel_removed", raw.replace(TATWEEL, "")],
    ["diacritics_removed", normalizeArabicQuery(raw)],
    ["controlled_letter_normalization", normalizeArabicQuery(raw)],
    ["maqsurah_yaa_variant", normalizeArabicQuery(raw).replace(/ى/g, "ي")],
    ["controlled_loose_variant", normalizeArabicQuery(raw).replace(/ى/g, "ي").replace(/ة/g, "ه")]
  ];

  const seen = new Set();
  const plan = [];
  for (const [kind, queryValue] of candidates) {
    const query = collapseSpaces(queryValue);
    if (!query || seen.has(query)) continue;
    seen.add(query);
    plan.push(Object.freeze({ kind, query }));
  }
  return Object.freeze(plan);
}

export async function searchWithArabicQueryPlan(searchFn, query, options = {}) {
  if (typeof searchFn !== "function") throw new TypeError("searchFn must be a function");
  const plan = createArabicQueryPlan(query);
  const hits = [];
  const seen = new Set();
  const errors = [];

  for (const variant of plan) {
    try {
      const results = await searchFn(variant.query, { ...options, query_variant: variant.kind });
      for (const hit of results ?? []) {
        const doc = hit?.document ?? hit;
        const key = String(doc?.node_id ?? doc?.id ?? doc?.evidence_id ?? JSON.stringify(doc ?? hit));
        if (seen.has(key)) continue;
        seen.add(key);
        hits.push(hit);
      }
    } catch (error) {
      errors.push({ variant: variant.kind, message: String(error?.message ?? error) });
    }
  }

  return Object.freeze({
    raw_query: String(query ?? ""),
    variants: plan,
    hits: Object.freeze(hits),
    errors: Object.freeze(errors)
  });
}
