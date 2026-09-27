import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildScholarlyAdapterRequest, canPromoteToPublicDownload, indexScholarlyFleet, validateScholarlyFleet } from "../src/rechercher-omega-scholarly-fleet.js";

const fleet = JSON.parse(fs.readFileSync(new URL("../config/rechercher-omega-scholarly-fleet.json", import.meta.url), "utf8"));

test("the scholarly fleet declares all shared contract axes", () => {
  const result = validateScholarlyFleet(fleet);
  assert.equal(result.valid, true, result.errors.join(", "));
  assert.equal(fleet.expansion.current_family_count, 9);
  assert.equal(fleet.expansion.target_domain_cells, 24);
  for (const family of fleet.families) {
    for (const axis of fleet.contract.required_axes) {
      assert.ok(family.contract[axis], family.id + " missing " + axis);
    }
  }
});

test("each family has an independent source set", () => {
  const index = indexScholarlyFleet(fleet);
  for (const family of fleet.families) {
    assert.equal(index.has(family.id), true);
    assert.ok(family.sources.length >= 1);
  }
  assert.equal(index.get("hadith").sources.some(s => s.id === "sunnah-com-api"), true);
  assert.equal(index.get("fatwa").sources.some(s => s.id === "saudi-alifta"), true);
  assert.equal(index.get("references").sources.some(s => s.id === "crossref"), true);
});

test("adapter requests are source-specific and carry provenance and rights", () => {
  const index = indexScholarlyFleet(fleet);
  const request = buildScholarlyAdapterRequest({
    fleetIndex: index,
    familyId: "hadith",
    sourceId: "sunnah-com-api",
    locator: "https://sunnah.stoplight.io/docs/api/",
    rightsStatus: "review_required",
    provenance: { retrieved_at: "2026-09-27T00:00:00Z", sha256: "abc" }
  });
  assert.equal(request.corpus_write_allowed, false);
  assert.equal(request.family_id, "hadith");
  assert.equal(request.source_id, "sunnah-com-api");
  assert.equal(request.rights_status, "review_required");
  assert.equal(request.provenance.sha256, "abc");
});

test("public download is fail-closed until rights are verified", () => {
  assert.equal(canPromoteToPublicDownload("review_required"), false);
  assert.equal(canPromoteToPublicDownload("blocked"), false);
  assert.equal(canPromoteToPublicDownload("link_only"), false);
  assert.equal(canPromoteToPublicDownload("verified_license"), true);
});

test("malformed fleets fail closed", () => {
  const invalid = structuredClone(fleet);
  invalid.contract.required_axes = ["production"];
  assert.equal(validateScholarlyFleet(invalid).valid, false);
});
