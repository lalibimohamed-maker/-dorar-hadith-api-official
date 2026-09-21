import assert from "node:assert/strict";
import test from "node:test";

const c = await import("../src/rechercher-openiti-shamela.js");

test("OpenITI connector exposes metadata/raw runtime", () => {
  const info = c.openItiConnectorInfo();
  assert.equal(info.runtime, "metadata-api-and-raw-release");
  assert.equal(info.corpusWrite, "never-direct");
});

test("OpenITI raw resolver blocks traversal", () => {
  assert.throws(() => c.openItiRawTextUrl({ path: "../secret" }), /path traversal/);
});

test("OpenITI raw resolver creates release-pinned URL", () => {
  assert.equal(
    c.openItiRawTextUrl({ release: "v2025.1.9", path: "data/0728IbnTaymiyya/0728IbnTaymiyya.MajmucFatawa/0728IbnTaymiyya.MajmucFatawa.JK000381-ara1" }),
    "https://raw.githubusercontent.com/OpenITI/RELEASE/v2025.1.9/data/0728IbnTaymiyya/0728IbnTaymiyya.MajmucFatawa/0728IbnTaymiyya.MajmucFatawa.JK000381-ara1"
  );
});

test("Shamela v4 runtime connector is key-gated and executable", async () => {
  const info = c.shamelaConnectorInfo();
  assert.equal(info.runtime, "api-key-configurable");
  assert.equal(info.apiKeyRequired, true);
  assert.equal(c.shamelaRuntimeConfig().configured, false);
  assert.equal(c.shamelaRuntimeConfig().apiKey, undefined);
  assert.match(c.shamelaDiscoveryUrl("ابن تيمية"), /^https:\/\/shamela\.ws\/search\?query=/);
  await assert.rejects(() => c.shamelaBookMetadata(1), /SHAMELA_API_KEY is required/);
  await assert.rejects(() => c.shamelaBookMetadata(0), /bookId must be a positive integer/);
});
