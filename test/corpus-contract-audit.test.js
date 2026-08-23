import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getRegistry, getSource } from "../src/source-registry.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const configDir = path.join(root, "..", "config");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(configDir, name), "utf8"));
}

test("canonical corpus is covered by the provenance source contract", () => {
  const corpus = readJson("canonical-corpus-seed-2026.json");
  const policy = readJson("corpus-provenance-policy-2026.json");
  const registry = getRegistry();
  const registryIds = new Set((registry.sources || []).map((source) => source.id));
  const policyTypes = new Set(policy.sourceTypes || []);

  assert.ok(Array.isArray(corpus.records) && corpus.records.length > 0);
  assert.ok(registryIds.size > 0);

  const failures = [];
  for (const record of corpus.records) {
    if (!policyTypes.has(record.sourceType)) {
      failures.push(`${record.recordId}: unsupported sourceType ${record.sourceType}`);
    }
    if (!registryIds.has(record.sourceId) || !getSource(record.sourceId)) {
      failures.push(`${record.recordId}: sourceId ${record.sourceId} missing from source registry`);
    }
  }

  assert.deepEqual(failures, [], `Corpus contract failures:\n${failures.join("\n")}`);
});

test("canonical corpus records preserve primary-source priority metadata", () => {
  const corpus = readJson("canonical-corpus-seed-2026.json");
  const primaryRecords = corpus.records.filter((record) => record.priority === "primary");

  assert.ok(primaryRecords.length > 0);
  for (const record of primaryRecords) {
    assert.equal(typeof record.sourceId, "string");
    assert.equal(typeof record.sourceType, "string");
    assert.equal(typeof record.titleOriginal, "string");
  }
});
