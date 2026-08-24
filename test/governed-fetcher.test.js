import test from "node:test";
import assert from "node:assert/strict";
import { planGovernedFetch } from "../src/governed-fetcher.js";

const valid = { connector: { allowed: true }, url: "https://example.invalid/book.pdf", contentType: "application/pdf", contentLength: 1024 };

test("authorized fetch is planned", () => {
  const result = planGovernedFetch(valid);
  assert.equal(result.allowed, true);
  assert.equal(result.state, "planned");
});

test("unauthorized connector is blocked", () => {
  const result = planGovernedFetch({ ...valid, connector: { allowed: false } });
  assert.equal(result.allowed, false);
  assert.ok(result.failures.includes("connector_not_authorized"));
});

test("unsupported content type is blocked", () => {
  const result = planGovernedFetch({ ...valid, contentType: "application/octet-stream" });
  assert.equal(result.allowed, false);
  assert.ok(result.failures.includes("content_type_not_allowed"));
});

test("oversized content is blocked", () => {
  const result = planGovernedFetch({ ...valid, contentLength: 26 * 1024 * 1024 });
  assert.equal(result.allowed, false);
  assert.ok(result.failures.includes("content_length_not_allowed"));
});
