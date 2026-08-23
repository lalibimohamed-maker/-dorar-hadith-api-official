import assert from "node:assert/strict";
import test from "node:test";
import { findDomainsForSource, findSourcesForDomain, getCorpusSourceMap } from "../src/corpus-source-map.js";

test("routes major domains to existing source identifiers", () => {
  const map = getCorpusSourceMap();
  assert.ok(map.domains.hadith.includes("bukhari"));
  assert.ok(map.domains.hadith.includes("muslim"));
  assert.ok(map.domains.quran.includes("quran"));
});

test("finds domains for a source", () => {
  assert.deepEqual(findDomainsForSource("bukhari"), ["hadith"]);
});

test("finds sources for a domain", () => {
  assert.deepEqual(findSourcesForDomain("quran"), ["quran"]);
  assert.ok(findSourcesForDomain("hadith").length >= 6);
});
