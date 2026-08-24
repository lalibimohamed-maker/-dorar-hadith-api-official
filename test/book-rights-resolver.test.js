import test from "node:test";
import assert from "node:assert/strict";
import { canMirror, canRedistribute, resolveRights, RIGHTS } from "../src/book-rights-resolver.js";

test("no evidence fails closed", () => {
  const r = resolveRights([]);
  assert.equal(r.status, RIGHTS.RIGHTS_UNCLEAR);
  assert.equal(canRedistribute(r), false);
});

test("free download is not redistribution permission", () => {
  const r = resolveRights([{ source: "library", kind: "free-download" }]);
  assert.equal(r.status, RIGHTS.RIGHTS_UNCLEAR);
  assert.equal(canMirror(r), false);
});

test("explicit redistribution permission permits mirroring", () => {
  const r = resolveRights([{ source: "publisher", kind: "explicit-redistribution-permission" }]);
  assert.equal(r.status, RIGHTS.REDISTRIBUTABLE);
  assert.equal(canMirror(r), true);
});

test("waqf requires an explicit redistribution allowance", () => {
  assert.equal(resolveRights([{ source: "waqf", kind: "waqf" }]).status, RIGHTS.RIGHTS_UNCLEAR);
  assert.equal(resolveRights([{ source: "waqf", kind: "waqf", allowsRedistribution: true }]).status, RIGHTS.REDISTRIBUTABLE);
});

test("conflicting evidence fails closed", () => {
  const r = resolveRights([
    { source: "publisher", kind: "explicit-redistribution-permission" },
    { source: "publisher", kind: "no-redistribution" }
  ]);
  assert.equal(r.status, RIGHTS.RIGHTS_UNCLEAR);
  assert.equal(r.conflict, true);
  assert.equal(canRedistribute(r), false);
});

test("official source defaults to link-only, not mirror", () => {
  const r = resolveRights([{ source: "official", kind: "official-source" }]);
  assert.equal(r.status, RIGHTS.LINK_ONLY);
  assert.equal(canMirror(r), false);
});
