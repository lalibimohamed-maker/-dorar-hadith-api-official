import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getRegistry, getSource } from "../src/source-registry.js";
import { getCorpusProvenancePolicy } from "../src/corpus-provenance.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configDir = path.join(__dirname, "..", "config");
const corpus = JSON.parse(fs.readFileSync(path.join(configDir, "canonical-corpus-seed-2026.json"), "utf8"));

test("canonical corpus source ids are covered by the runtime source registry", () => {
  const registry = getRegistry();
  const registryIds = new Set((registry.sources || []).map((source) => source.id));
  const missing = corpus.records
    .map((record) => record.sourceId)
    .filter((sourceId) => !registryIds.has(sourceId));

  assert.deepEqual(missing, [], `Canonical corpus source ids missing from runtime registry: ${missing.join(", ")}`);
});

test("canonical corpus source types are covered by the provenance policy", () => {
  const policy = getCorpusProvenancePolicy();
  const unsupported = corpus.records
    .map((record) => record.sourceType)
    .filter((sourceType, index, all) => !policy.sourceTypes.includes(sourceType) && all.indexOf(sourceType) === index);

  assert.deepEqual(unsupported, [], `Canonical corpus source types missing from provenance policy: ${unsupported.join(", ")}`);
});

test("every canonical corpus source resolves through getSource", () => {
  const unresolved = corpus.records
    .filter((record) => !getSource(record.sourceId))
    .map((record) => record.sourceId);

  assert.deepEqual(unresolved, [], `Canonical corpus source ids cannot be resolved by getSource: ${unresolved.join(", ")}`);
});
