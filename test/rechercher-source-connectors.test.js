import assert from "node:assert/strict";
import test from "node:test";

const connector = await import("../src/rechercher-source-connectors.js");

test("IslamHouse connector exposes runtime API contract", () => {
  const info = connector.islamHouseConnectorInfo();
  assert.equal(info.runtime, "public-api-v3");
  assert.equal(info.corpusWrite, "never-direct");
});

test("IslamHouse endpoint builder is exercised without live network", async () => {
  const original = globalThis.fetch;
  let requested = "";
  globalThis.fetch = async (url) => {
    requested = String(url);
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  try {
    const result = await connector.islamHouseItem("2807064", "ar");
    assert.deepEqual(result, { ok: true });
    assert.match(requested, /api3\.islamhouse\.com\/main\/get-item\/2807064\/ar\/json$/);
  } finally {
    globalThis.fetch = original;
  }
});

test("Gallica connector builds an SRU search URL", async () => {
  const original = globalThis.fetch;
  let requested = "";
  globalThis.fetch = async (url) => {
    requested = String(url);
    return { ok: true, status: 200, json: async () => ({ numberOfRecords: 0 }) };
  };
  try {
    const result = await connector.gallicaSearch({ query: "الطبري" });
    assert.equal(result.numberOfRecords, 0);
    assert.match(requested, /^https:\/\/gallica\.bnf\.fr\/services\/engine\/search\/sru\?/);
    assert.match(requested, /format=json/);
  } finally {
    globalThis.fetch = original;
  }
});

test("IIIF connector rejects untrusted origins", () => {
  assert.throws(() => connector.iiifManifestUrl("qdl", "https://evil.example/manifest"), /not allowlisted/);
});

test("IIIF connector accepts a known QDL manifest origin", () => {
  const url = "https://www.qdl.qa/en/iiif/81055/vdc_100000000691.0x0001dd/manifest";
  assert.equal(connector.iiifManifestUrl("qdl", url), url);
});

test("connector health reports runtime providers without claiming rights", () => {
  const health = connector.sourceConnectorHealth();
  assert.equal(health.islamhouse.configured, true);
  assert.equal(health["iiif-manifest"].providers >= 8, true);
});
