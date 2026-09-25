import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const catalog = JSON.parse(
  fs.readFileSync(
    new URL("../config/quran-multisource-translation-catalog-2026-09-22.json", import.meta.url),
    "utf8",
  ),
);

test("Quran translation catalog keeps canonical Arabic and AI policy boundaries", () => {
  assert.equal(catalog.layer, "System");
  assert.equal(catalog.policy.canonical_arabic_separate, true);
  assert.equal(catalog.policy.ai_generated_translation_forbidden, true);
  assert.equal(catalog.policy.primary_source_verification_required, true);
  assert.equal(catalog.policy.rights_verification_required, true);
  assert.equal(catalog.policy.corpus_write_forbidden, true);
});

test("Quran translation catalog contains the persisted QuranEnc coverage without granting admission", () => {
  const quranEnc = catalog.editions.filter((edition) => edition.source_id === "quranenc");
  const languages = new Set(quranEnc.map((edition) => edition.language_iso_code));
  assert.equal(quranEnc.length, 74);
  assert.equal(languages.size, 55);

  for (const edition of quranEnc) {
    assert.ok(edition.edition_id);
    assert.ok(edition.language_iso_code);
    assert.equal(edition.matrix_eligibility, "blocked_pending_verification");
    assert.equal(edition.text_integrity_status, "pending");
  }
});

test("KFGQPC official institutional editions are present but publication-blocked", () => {
  const kfgqpc = catalog.editions.filter((edition) => edition.source_id === "kfgqpc");
  assert.equal(kfgqpc.length, 12);
  assert.ok(kfgqpc.every((edition) => edition.primary_source_verification?.status === "primary_source_verified"));
  assert.ok(kfgqpc.every((edition) => edition.rights_verification?.status === "pending"));
  assert.ok(kfgqpc.every((edition) => edition.text_integrity_status === "pending"));
  assert.ok(kfgqpc.every((edition) => edition.matrix_eligibility === "blocked_pending_rights_and_integrity"));
  assert.ok(kfgqpc.every((edition) => edition.acquisition_status === "not_acquired"));
  const kannada = kfgqpc.find((edition) => edition.edition_id === "kfgqpc-kannada");
  assert.ok(kannada);
  assert.equal(kannada.language_iso_code, "kn");
  assert.equal(kannada.asset_url_status, "official_file_confirmed");
  assert.equal(kannada.asset_kind, "pdf");
  assert.ok(kannada.asset_urls.includes("https://qurancomplex.gov.sa/wp-content/uploads/isdarat/translations/kannada-1.pdf"));
});

test("verified primary-source provenance does not silently grant redistribution rights", () => {
  for (const edition of catalog.editions) {
    if (edition.primary_source_verification?.status === "primary_source_verified") {
      assert.notEqual(edition.rights_verification?.status, "verified_for_public_use");
    }
  }
});
