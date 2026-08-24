import test from "node:test";
import assert from "node:assert/strict";
import { evaluateReaderAccess } from "../src/reader-copy-policy.js";

test("redistributable content can be read, copied, and exported", () => {
  const result = evaluateReaderAccess({ rights: { status: "public-domain" } });
  assert.deepEqual(result, { canRead: true, canCopyText: true, canRedistribute: true, reason: "source_and_rights_policy" });
});

test("read-only content may be readable and copyable only when the source permits it", () => {
  const result = evaluateReaderAccess({ rights: { status: "read-only" }, sourceAllowsReading: true, sourceAllowsCopy: true });
  assert.equal(result.canRead, true);
  assert.equal(result.canCopyText, true);
  assert.equal(result.canRedistribute, false);
});

test("read-only content is not copyable when the source does not permit copying", () => {
  const result = evaluateReaderAccess({ rights: { status: "read-only" }, sourceAllowsReading: true });
  assert.equal(result.canRead, true);
  assert.equal(result.canCopyText, false);
  assert.equal(result.canRedistribute, false);
});

test("restricted content remains blocked by default", () => {
  const result = evaluateReaderAccess({ rights: { status: "restricted" } });
  assert.equal(result.canRead, false);
  assert.equal(result.canCopyText, false);
  assert.equal(result.canRedistribute, false);
});
