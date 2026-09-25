import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const registry = JSON.parse(fs.readFileSync(
  new URL("../config/quran-official-saudi-kfgqpc-translation-registry-2026-09-22.json", import.meta.url),
  "utf8",
));
const config = JSON.parse(fs.readFileSync(
  new URL("../config/quran-kfgqpc-official-acquisition-2026-09-22.json", import.meta.url),
  "utf8",
));

test("KFGQPC Kannada is anchored to official publication and download hosts", () => {
  const edition = registry.language_editions.find(x => x.edition_id === "kfgqpc-kannada");
  assert.ok(edition);
  assert.equal(edition.language_iso_code, "kn");
  assert.equal(edition.official_page, "https://qurancomplex.gov.sa/en/kfgqpc-quran-translate-kannada/");
  assert.deepEqual(edition.asset_urls, [
    "https://qurancomplex.gov.sa/wp-content/uploads/isdarat/translations/kannada-1.pdf"
  ]);
  assert.deepEqual(edition.asset_index_urls, [
    "https://epub.qurancomplex.gov.sa/issues/translations/kannada/",
    "https://download.qurancomplex.gov.sa/issues/translations/kannada/"
  ]);
  assert.equal(edition.acquisition_status, "not_acquired");
  assert.equal(edition.rights_verification, "pending");
  assert.equal(edition.text_integrity_status, "pending");
  assert.equal(edition.matrix_eligibility, "blocked_pending_rights_and_integrity");
});

test("KFGQPC acquisition is restricted to official hosts and preserves governance boundaries", () => {
  assert.deepEqual(config.allowed_hosts.sort(), [
    "download.qurancomplex.gov.sa",
    "epub.qurancomplex.gov.sa",
    "qurancomplex.gov.sa"
  ]);
  assert.equal(config.policy.corpus_write_forbidden, true);
  assert.equal(config.policy.ai_generated_translation_forbidden, true);

  const expectedEditionIds = [
    "kfgqpc-german",
    "kfgqpc-tamazight",
    "kfgqpc-english",
    "kfgqpc-turkish",
    "kfgqpc-dari",
    "kfgqpc-russian",
    "kfgqpc-swahili",
    "kfgqpc-chinese",
    "kfgqpc-french",
    "kfgqpc-fulani",
    "kfgqpc-nepali",
    "kfgqpc-kannada"
  ];

  assert.equal(config.editions.length, expectedEditionIds.length);
  assert.deepEqual(
    config.editions.map(edition => edition.edition_id),
    expectedEditionIds
  );

  for (const edition of config.editions) {
    assert.equal(edition.source_id, "kfgqpc");
    assert.ok(edition.official_page.startsWith("https://qurancomplex.gov.sa/"));
    for (const url of edition.asset_index_urls) {
      assert.ok(url.startsWith("https://"));
      assert.ok(config.allowed_hosts.includes(new URL(url).hostname));
    }
    for (const url of edition.asset_urls) {
      assert.ok(url.startsWith("https://"));
      assert.ok(config.allowed_hosts.includes(new URL(url).hostname));
    }
  }
});
