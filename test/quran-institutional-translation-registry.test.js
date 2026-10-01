import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const registry = JSON.parse(
  fs.readFileSync(
    new URL("../config/quran-official-institutional-translation-registry-2026-09-22.json", import.meta.url),
    "utf8",
  ),
);

test("institutional Quran translation registry keeps source and rights gates separate", () => {
  assert.equal(registry.policy.canonical_arabic_separate, true);
  assert.equal(registry.policy.ai_generated_translation_forbidden, true);
  assert.equal(registry.policy.primary_source_required, true);
  assert.equal(registry.policy.rights_verification_required, true);
  assert.equal(registry.policy.corpus_write_forbidden, true);

  const editions = registry.sources.flatMap((source) => source.language_editions);
  assert.ok(editions.some((edition) => edition.language_iso_code === "bn"));
  assert.ok(editions.some((edition) => edition.language_iso_code === "tr"));
  assert.ok(editions.some((edition) => edition.language_iso_code === "fr"));
  assert.ok(editions.some((edition) => edition.language_iso_code === "en"));
  assert.ok(editions.some((edition) => edition.language_iso_code === "es"));
  assert.ok(editions.some((edition) => edition.language_iso_code === "id"));

  for (const edition of editions) {
    assert.equal(edition.primary_source_verification, "verified");
    assert.equal(edition.rights_verification, "pending");
    assert.equal(edition.text_integrity_status, "pending");
    assert.notEqual(edition.matrix_eligibility, "verified_for_public_use");
  }
});
