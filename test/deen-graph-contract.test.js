import test from "node:test";
import assert from "node:assert/strict";
import { validateGraph, assertSourceBackedEvidence, isTrustedEvidence } from "../src/deen-graph-contract.js";

test("valid source-backed graph passes", () => {
  const graph = validateGraph({
    nodes: [
      { id: "q:1:1", type: "quran_verse", provenance: { sourceId: "quran", citation: "1:1" } },
      { id: "h:1", type: "hadith", provenance: { sourceId: "bukhari", citation: "1", verificationState: "source_verified" } }
    ],
    edges: [{ id: "e:1", from: "q:1:1", to: "h:1", type: "related_to", provenance: { sourceId: "link-registry", citation: "registry:e:1" } }]
  });
  assert.equal(graph.valid, true);
});

test("missing endpoints are rejected", () => {
  const graph = validateGraph({ nodes: [{ id: "h:1", type: "hadith", provenance: {} }], edges: [{ id: "e:1", from: "h:1", to: "missing", type: "related_to", provenance: {} }] });
  assert.equal(graph.valid, false);
  assert.ok(graph.errors.some((error) => error.includes("missing-to-node")));
});

test("generated evidence cannot cross the source firewall", () => {
  assert.throws(() => assertSourceBackedEvidence({ generated: true, sourceId: "ai", citation: "generated" }), /Generated content/);
});

test("only explicit trusted states are trusted", () => {
  assert.equal(isTrustedEvidence({ verificationState: "source_verified" }), true);
  assert.equal(isTrustedEvidence({ verificationState: "pending_verification" }), false);
});
