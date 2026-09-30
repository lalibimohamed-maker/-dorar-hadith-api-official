import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("offline store is browser-native, verified-only and content-hash bound", async () => {
  const source = await readFile("web/omega-offline-store.js", "utf8");
  assert.match(source, /indexedDB\.open/);
  assert.match(source, /verification_status/);
  assert.match(source, /content_sha256/);
  assert.match(source, /crypto\.subtle\.digest/);
  assert.match(source, /EVIDENCE_CONTENT_HASH_MISMATCH/);
  assert.match(source, /window\.deenAllahOmegaLocalStore/);
});

test("local provider attaches IndexedDB search and concept providers", async () => {
  const source = await readFile("web/omega-local-provider.js", "utf8");
  assert.match(source, /attachIndexedDbStore/);
  assert.match(source, /searchEvidence/);
  assert.match(source, /window\.deenAllahOmegaLocalSearch/);
  assert.match(source, /window\.deenAllahOmegaLocalConcept/);
});
