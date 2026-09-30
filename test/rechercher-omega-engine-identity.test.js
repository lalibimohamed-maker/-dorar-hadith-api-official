import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeEngineIdentity,
  assertEngineActivation
} from "../src/rechercher-omega-engine-identity.js";

const base = {
  engine_id: "qwen3",
  model_id: "Qwen/Qwen3-0.6B",
  revision: "c1899de289a04d12100db370d81485cdf75e47ca",
  runtime: "omega-local",
  artifact: {
    kind: "release_asset",
    reference: "dinullah-omega-qwen3-0.6b-v1.0.0",
    sha256: "a".repeat(64)
  },
  license: {
    code: "Apache-2.0",
    status: "verified_source_license"
  },
  rights_state: "public_allowed",
  activation_state: "active"
};

test("engine identity is normalized to the shared contract", () => {
  const identity = normalizeEngineIdentity(base);
  assert.equal(identity.engine_id, "qwen3");
  assert.equal(identity.artifact.sha256.length, 64);
  assert.equal(assertEngineActivation(identity), true);
});

test("active engines fail closed without immutable artifact identity", () => {
  const identity = {
    ...base,
    artifact: { ...base.artifact, sha256: null }
  };
  assert.throws(() => assertEngineActivation(identity), /SHA-256/);
});

test("active engines fail closed when rights require review", () => {
  const identity = { ...base, rights_state: "review_required" };
  assert.throws(() => assertEngineActivation(identity), /rights/);
});

test("invalid registry states are rejected", () => {
  assert.throws(
    () => normalizeEngineIdentity({ ...base, activation_state: "running" }),
    /activation state/
  );
});
