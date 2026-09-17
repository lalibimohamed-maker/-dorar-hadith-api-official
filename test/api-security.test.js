import test from "node:test";
import assert from "node:assert/strict";
import { clientIp, createRateLimiter, edgeRequestAllowed, queryArrayTooLarge, requestBodyTooLarge, requestUrlTooLarge, protectedPath } from "../src/api-security.js";

function request(headers = {}, remoteAddress = "127.0.0.1", url = "/") {
  return { headers, socket: { remoteAddress }, url };
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

test("oversized request bodies and URLs are rejected", () => {
  assert.equal(requestBodyTooLarge(request({ "content-length": "1048577" }), 1048576), true);
  assert.equal(requestBodyTooLarge(request({ "content-length": "1024" }), 1048576), false);
  assert.equal(requestUrlTooLarge(request({}, "127.0.0.1", `/?q=${"x".repeat(9000)}`), 8192), true);
  assert.equal(requestUrlTooLarge(request({}, "127.0.0.1", "/search?q=ok"), 8192), false);
});

test("batch-like query parameters are bounded", () => {
  assert.equal(queryArrayTooLarge(request({}, "127.0.0.1", `/?translationIds=${Array.from({ length: 51 }, (_, i) => i + 1).join(",")}`), 50), true);
  assert.equal(queryArrayTooLarge(request({}, "127.0.0.1", `/?translationIds=${Array.from({ length: 50 }, (_, i) => i + 1).join(",")}`), 50), false);
  assert.equal(queryArrayTooLarge(request({}, "127.0.0.1", `/?judgments=${encodeURIComponent(JSON.stringify(Array.from({ length: 51 }, () => ({ source: "x" }))) )}`), 50), true);
});

test("Cloudflare client identity uses CF-Connecting-IP only from a trusted proxy", () => {
  process.env.TRUST_PROXY = "true";
  process.env.TRUST_PROXY_MODE = "cloudflare";
  process.env.TRUSTED_PROXY_CIDRS = "203.0.113.0/24";
  const trusted = request({ "cf-connecting-ip": "198.51.100.7", "x-forwarded-for": "198.51.100.8" }, "203.0.113.10");
  const untrusted = request({ "cf-connecting-ip": "198.51.100.7", "x-forwarded-for": "198.51.100.8" }, "198.18.0.2");
  assert.equal(clientIp(trusted), "198.51.100.7");
  assert.equal(clientIp(untrusted), "198.18.0.2");
  assert.equal(edgeRequestAllowed(trusted), true);
  delete process.env.TRUST_PROXY;
  delete process.env.TRUST_PROXY_MODE;
  delete process.env.TRUSTED_PROXY_CIDRS;
});

test("internal and admin paths are protected", () => {
  assert.equal(protectedPath("/internal/job"), true);
  assert.equal(protectedPath("/admin/config"), true);
  assert.equal(protectedPath("/rechercher/internal/acquire"), true);
  assert.equal(protectedPath("/search"), false);
});
