import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("offline evidence store exposes integrity-bound import/export", async () => {
  const source = await readFile("web/omega-offline-store.js", "utf8");
  assert.match(source, /exportEvidenceBundle/);
  assert.match(source, /importEvidenceBundle/);
  assert.match(source, /bundle_sha256/);
  assert.match(source, /OFFLINE_BUNDLE_HASH_MISMATCH/);
  assert.match(source, /EVIDENCE_CONTENT_HASH_MISMATCH/);
});

test("offline UI exposes portable evidence controls", async () => {
  const source = await readFile("web/offline-omega-ui.js", "utf8");
  assert.match(source, /data-omega-export/);
  assert.match(source, /data-omega-import/);
  assert.match(source, /deen-allah-omega-offline-evidence\.json/);
  assert.match(source, /رُفضت الحزمة/);
});
