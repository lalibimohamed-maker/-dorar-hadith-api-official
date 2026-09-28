import test from "node:test";
import assert from "node:assert/strict";
import { canCopyText, canMirror, canRead, canRedistribute, resolveRights, RIGHTS } from "../src/book-rights-resolver.js";

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


test("licensed and public-domain evidence has full redistribution permission", () => {
  const licensed = resolveRights([{ source: "license", kind: "licensed" }]);
  assert.equal(licensed.status, RIGHTS.LICENSED);
  assert.equal(canRedistribute(licensed), true);
  assert.equal(canCopyText(licensed), true);
  assert.equal(canRead(licensed), true);

  const publicDomain = resolveRights([{ source: "archive", kind: "public-domain" }]);
  assert.equal(publicDomain.status, RIGHTS.PUBLIC_DOMAIN);
  assert.equal(canRedistribute(publicDomain), true);
});

test("read-copy allows reading and Copy Text but not redistribution", () => {
  const result = resolveRights([{ source: "publisher", kind: "read-copy-permission" }]);
  assert.equal(result.status, RIGHTS.READ_COPY);
  assert.equal(canRead(result), true);
  assert.equal(canCopyText(result), true);
  assert.equal(canRedistribute(result), false);
});

test("read-only requires explicit source reading permission", () => {
  const result = resolveRights([{ source: "publisher", kind: "read-only-permission" }]);
  assert.equal(result.status, RIGHTS.READ_ONLY);
  assert.equal(canRead(result), false);
  assert.equal(canRead(result, { sourceAllowsReading: true }), true);
  assert.equal(canCopyText(result, { sourceAllowsReading: true, sourceAllowsCopy: true }), true);
});

test("restricted rights remain blocked even when source permissions are supplied", () => {
  const result = resolveRights([{ source: "publisher", kind: "restricted" }]);
  assert.equal(canRead(result, { sourceAllowsReading: true }), false);
  assert.equal(canCopyText(result, { sourceAllowsReading: true, sourceAllowsCopy: true }), false);
  assert.equal(canRedistribute(result), false);
});
