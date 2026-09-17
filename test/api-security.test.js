import test from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter, requestBodyTooLarge, protectedPath } from "../src/api-security.js";

function request(headers = {}, remoteAddress = "127.0.0.1") {
  return { headers, socket: { remoteAddress } };
}

test("rate limiter isolates clients and rejects after configured budget", () => {
  const limit = createRateLimiter({ max: 2, windowMs: 60_000, prefix: "test" });
  assert.equal(limit(request()).allowed, true);
  assert.equal(limit(request()).allowed, true);
  assert.equal(limit(request()).allowed, false);
  assert.equal(limit(request({}, "127.0.0.2")).allowed, true);
});

test("API key rate identity is separated from IP identity", () => {
  const limit = createRateLimiter({ max: 1, windowMs: 60_000, prefix: "test-key" });
  assert.equal(limit(request({ "x-api-key": "key-a" })).allowed, true);
  assert.equal(limit(request({ "x-api-key": "key-a" })).allowed, false);
  assert.equal(limit(request({ "x-api-key": "key-b" })).allowed, true);
});

test("oversized request bodies are rejected by content length", () => {
  assert.equal(requestBodyTooLarge(request({ "content-length": "1048577" }), 1048576), true);
  assert.equal(requestBodyTooLarge(request({ "content-length": "1024" }), 1048576), false);
});

test("internal and admin paths are protected", () => {
  assert.equal(protectedPath("/internal/job"), true);
  assert.equal(protectedPath("/admin/config"), true);
  assert.equal(protectedPath("/rechercher/internal/acquire"), true);
  assert.equal(protectedPath("/search"), false);
});
