import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const registry = JSON.parse(
  fs.readFileSync(
    new URL("../config/quran-official-saudi-kfgqpc-translation-registry-2026-09-22.json", import.meta.url),
    "utf8",
  ),
);

test("KFGQPC official translation registry is governance-safe", () => {
  assert.equal(registry.source.source_id, "sa-kfgqpc");
  assert.equal(registry.policy.canonical_arabic_separate, true);
  assert.equal(registry.policy.ai_generated_translation_forbidden, true);
  assert.equal(registry.policy.corpus_write_forbidden, true);
  assert.equal(registry.policy.rights_verification_required, true);
  assert.equal(registry.language_editions.length, 12);

  const codes = new Set(registry.language_editions.map((x) => x.language_iso_code));
  for (const code of ["de","ber","en","tr","prs","ru","sw","zh","fr","ff","ne","kn"]) {
    assert.ok(codes.has(code), code);
  }

  assert.equal(registry.verification_defaults.primary_source_verification, "primary_source_verified");
  assert.equal(registry.verification_defaults.rights_verification, "pending");
  assert.equal(registry.verification_defaults.text_integrity_status, "pending");
  assert.equal(registry.verification_defaults.matrix_eligibility, "blocked_pending_rights_and_integrity");
  assert.equal(registry.verification_defaults.public_publishable, false);
});
