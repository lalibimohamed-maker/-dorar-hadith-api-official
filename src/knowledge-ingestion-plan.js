export const INGESTION_PIPELINE = Object.freeze({
  stages: [
    "discover_source",
    "license_check",
    "capture_original_reference",
    "parse_record",
    "normalize_concept",
    "verify_text",
    "verify_grade",
    "link_scholar_and_book",
    "preserve_disagreement",
    "index_languages",
    "run_tests",
    "publish_verified_record"
  ],
  publicationRule: "لا يدخل السجل طبقة verified إلا بعد اكتمال المصدر والموضع وحالة التحقق.",
  fallback: "يبقى السجل في needs-source-verification ولا يظهر كحقيقة موثقة.",
  multilingualRule: "النص الشرعي العربي يبقى أصلًا؛ ترجمة المعنى تحفظ كمعلومة مستقلة مع مصدرها.",
  domains: [
    "quran",
    "tafsir",
    "hadith",
    "aqeedah",
    "fiqh",
    "seerah",
    "duas",
    "worship",
    "zakat",
    "inheritance",
    "prophetic_medicine",
    "scholars",
    "history",
    "arabic_language",
    "sermons",
    "family",
    "refutations",
    "afterlife"
  ]
});
