import test from "node:test";
import assert from "node:assert/strict";
import { classifyBookForDelivery, CONTENT_SCOPE } from "../src/universal-religious-scholarly-delivery.js";

test("religious scholarly book is in scope", () => {
  const r = classifyBookForDelivery({ domain: CONTENT_SCOPE.IN_SCOPE, rights: { status: "public-domain" } });
  assert.equal(r.scope, CONTENT_SCOPE.IN_SCOPE);
  assert.equal(r.redistributable, true);
});

test("general-world books are out of scope", () => {
  const r = classifyBookForDelivery({ domain: CONTENT_SCOPE.OUT_OF_SCOPE, rights: { status: "public-domain" } });
  assert.equal(r.eligible, false);
  assert.equal(r.scope, CONTENT_SCOPE.OUT_OF_SCOPE);
});

test("unapproved sources are not delivered as trusted corpus", () => {
  const r = classifyBookForDelivery({ domain: CONTENT_SCOPE.IN_SCOPE, sourceClass: "unapproved", rights: { status: "public-domain" } });
  assert.equal(r.eligible, false);
});

test("comparative-critical material is not promoted to approved source", () => {
  const r = classifyBookForDelivery({ domain: CONTENT_SCOPE.IN_SCOPE, sourceClass: "comparative-critical", rights: { status: "read-only" } });
  assert.equal(r.eligible, false);
  assert.equal(r.comparativeOnly, true);
});

test("Quran keeps a special Arabic-source policy", () => {
  const r = classifyBookForDelivery({ domain: CONTENT_SCOPE.IN_SCOPE, quran: true, rights: { status: "unknown" } });
  assert.equal(r.quranSpecialPolicy, true);
  assert.equal(r.scope, CONTENT_SCOPE.IN_SCOPE);
});
