import assert from "node:assert/strict";
import test from "node:test";
import { getFreeCoreConfig, getFreeCoreSnapshot, getSourceRouting, listFreeCoreDomains, listFreeCoreSources, searchFreeCore } from "../src/free-core.js";

test("free core does not require OpenAI or a paid API", () => {
  const config = getFreeCoreConfig();
  assert.equal(config.requiresOpenAI, false);
  assert.equal(config.requiresPaidAPI, false);
  assert.equal(config.aiPolicy.apiKeyRequiredForCore, false);
});

test("free core exposes the encyclopedia domains and routing", () => {
  const domains = listFreeCoreDomains();
  assert.ok(domains.some((domain) => domain.id === "quran"));
  assert.ok(domains.some((domain) => domain.id === "hadith"));
  assert.ok(domains.some((domain) => domain.id === "tafsir"));
  assert.ok(domains.some((domain) => domain.id === "fiqh"));
  assert.ok(domains.some((domain) => domain.id === "fatwa"));
  assert.ok(domains.some((domain) => domain.id === "faraid"));
  assert.ok(domains.find((domain) => domain.id === "fatwa").routing.requires.includes("issuer"));
});

test("free core exposes catalogued sources with provenance metadata", () => {
  const result = listFreeCoreSources();
  assert.ok(result.sourceCount > 0);
  assert.ok(result.authorCount > 0);
  assert.ok(result.sources.some((source) => source.id === "quran"));
  assert.ok(result.sources.some((source) => source.id === "bukhari"));
  assert.ok(result.sourcePriority.includes("official_fatwa"));
});

test("source routing preserves verification rules", () => {
  const routing = getSourceRouting();
  assert.equal(routing.verification.pendingCannotBePresentedAsVerified, true);
  assert.equal(routing.verification.disagreementMustBePreserved, true);
  assert.equal(routing.verification.translationCannotReplaceOriginal, true);
});

test("free core search works without AI and returns routing metadata", () => {
  const result = searchFreeCore("صحيح البخاري");
  assert.equal(result.aiRequired, false);
  assert.ok(result.count > 0);
  assert.equal(result.sourceRoutingVersion, "2026.08");
});

test("free core snapshot is deterministic and source-aware", () => {
  const snapshot = getFreeCoreSnapshot();
  assert.equal(snapshot.requiresOpenAI, false);
  assert.equal(snapshot.requiresPaidAPI, false);
  assert.ok(snapshot.domainCount >= 10);
  assert.ok(snapshot.corpusRecordCount > 0);
  assert.ok(snapshot.sourceCount > 0);
  assert.equal(snapshot.sourceRoutingVersion, "2026.08");
});
