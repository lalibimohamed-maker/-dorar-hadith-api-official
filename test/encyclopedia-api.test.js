import assert from "node:assert/strict";
import test from "node:test";
import { getEncyclopediaDomainInfo, getEncyclopediaSourceInfo, searchEncyclopedia } from "../src/encyclopedia-api.js";

test("unified encyclopedia API searches the existing core", () => {
  const result = searchEncyclopedia("صحيح البخاري", { verifiedOnly: false });
  assert.equal(result.apiVersion, "2026-08-23");
  assert.equal(result.aiRequired, false);
  assert.ok(result.count > 0);
  assert.ok(Array.isArray(result.results[0].domains));
});

test("source endpoint returns domain routing", () => {
  const result = getEncyclopediaSourceInfo("bukhari");
  assert.deepEqual(result.domains, ["hadith"]);
  assert.ok(result.relatedSources.includes("muslim"));
});

test("domain endpoint returns routed sources", () => {
  const result = getEncyclopediaDomainInfo("hadith");
  assert.ok(result.sources.includes("bukhari"));
  assert.ok(result.sources.includes("muslim"));
});
