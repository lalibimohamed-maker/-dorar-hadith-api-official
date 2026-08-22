import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, "config", name), "utf8"));

test("canonical corpus seed keeps primary sources and classical references distinct", () => {
  const corpus = read("canonical-corpus-seed-2026.json");
  assert.ok(corpus.records.some((r) => r.recordId === "book-bukhari" && r.priority === "primary"));
  assert.ok(corpus.records.some((r) => r.recordId === "fatwa-saudi-permanent" && r.priority === "primary"));
  assert.ok(corpus.records.some((r) => r.recordId === "fatwa-ibn-taymiyyah-kubra" && r.priority === "secondary-classical-reference"));
  assert.equal(corpus.policy.fullTextRequiresRightsAndSourceVerification, true);
});

test("ingestion batches require verification gates before publication", () => {
  const batches = read("corpus-ingestion-batches-2026.json");
  for (const gate of ["rights-check", "edition-check", "source-verification", "stable-citation", "lexical-linking", "fiqh-term-resolution", "translation-review"]) {
    assert.ok(batches.gates.includes(gate));
  }
  assert.equal(batches.failurePolicy, "stop-publication-for-record-and-retain-audit-state");
});

test("translation batch contains the agreed twenty languages", () => {
  const batches = read("corpus-ingestion-batches-2026.json");
  const batch = batches.batches.find((b) => b.id === "translation-20-001");
  assert.equal(batch.languages.length, 20);
  assert.ok(batch.languages.includes("ar"));
  assert.ok(batch.languages.includes("en"));
  assert.ok(batch.languages.includes("ko"));
});
