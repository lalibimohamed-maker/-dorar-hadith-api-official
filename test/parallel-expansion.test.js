import test from "node:test";
import assert from "node:assert/strict";
import { getFiqhTerminologyMap, getGlobalFatwaAuthorityRegistry, getLexicalDecompositionPolicy, getTranslationPolicy, listArabicLanguageSources, listFiqhTerms, listGlobalFatwaAuthorities, listLanguages } from "../src/source-registry.js";

test("fiqh terminology expansion is available by domain", () => {
  const map = getFiqhTerminologyMap();
  assert.equal(map.expansion.version, "2026.4");
  assert.ok(listFiqhTerms({ domain: "ibadat" }).length >= 5);
  assert.ok(listFiqhTerms({ domain: "usul-al-fiqh" }).length >= 5);
  assert.ok(listFiqhTerms({ domain: "muamalat" }).length >= 4);
  assert.ok(listFiqhTerms({ domain: "fatwa" }).some((term) => term.term === "فتوى"));
});

test("Arabic lexical decomposition has provenance and review controls", () => {
  const policy = getLexicalDecompositionPolicy();
  assert.equal(policy.policy.originalTextPreserved, true);
  assert.ok(policy.layers.includes("root"));
  assert.ok(policy.layers.includes("morphology"));
  assert.ok(policy.layers.includes("fiqh-usage"));
  assert.ok(policy.reviewStatuses.includes("scholar-reviewed"));
  assert.ok(policy.primaryLexicalSources.includes("لسان العرب"));
});

test("global fatwa authority registry preserves jurisdictions and audit regions", () => {
  const registry = getGlobalFatwaAuthorityRegistry();
  assert.equal(registry.policy.officialStatusRequiresVerification, true);
  assert.ok(registry.nextAuditRegions.length >= 8);
  assert.ok(listGlobalFatwaAuthorities({ country: "مصر" }).length >= 1);
  assert.ok(listGlobalFatwaAuthorities({ country: "الجزائر" }).length >= 1);
  assert.ok(listGlobalFatwaAuthorities({ country: "السعودية" }).some((x) => x.priority === "primary"));
  assert.ok(registry.umbrella.id === "general-secretariat-fatwa-authorities-worldwide");
});

test("translation pipeline covers the agreed 20 priority languages", () => {
  const policy = getTranslationPolicy();
  assert.equal(policy.sourceLanguage, "ar");
  assert.equal(policy.preserveOriginal, true);
  assert.equal(policy.priorityLanguages.length, 20);
  assert.ok(policy.pipeline.includes("arabic-lexical-analysis"));
  assert.ok(policy.pipeline.includes("fiqh-term-resolution"));
  assert.ok(policy.pipeline.includes("scholarly-review-when-required"));
  assert.equal(policy.safetyRules.neverOverwriteSource, true);
  assert.equal(policy.globalExpansion, true);
});

test("Arabic language primary source layer remains queryable", () => {
  const sources = listArabicLanguageSources();
  assert.ok(sources.length >= 5);
  assert.ok(sources.some((source) => source.nameAr?.includes("لسان العرب")));
  assert.ok(sources.every((source) => source.language === "ar"));
});

test("agreed 20 languages remain stable", () => {
  const languages = listLanguages({ agreed20: true });
  assert.equal(languages.length, 20);
  for (const code of ["ar","en","fr","es","de","tr","ur","id","ms","bn","hi","ru","fa","zh","sw","ha","pt","it","ja","ko"]) assert.ok(languages.some((language) => language.code === code));
});
