import test from "node:test";
import assert from "node:assert/strict";
import { getComplexFaraidCase, listComplexFaraidCases } from "../src/faraid-complex-cases.js";

test("complex faraid registry includes the required specialized cases", () => {
  const ids = listComplexFaraidCases().map((x) => x.id);
  for (const id of ["grandfather-with-siblings", "munasakhat", "pregnancy", "missing-person", "khuntha", "awl", "radd", "correction"]) {
    assert.ok(ids.includes(id), `missing ${id}`);
  }
});

test("complex cases expose a safe action instead of pretending every case is automatic", () => {
  for (const item of listComplexFaraidCases()) {
    assert.equal(typeof item.safeAction, "string");
    assert.ok(item.descriptionAr.length > 20);
  }
});

test("a specific complex case can be retrieved", () => {
  const item = getComplexFaraidCase("pregnancy");
  assert.equal(item.titleAr, "الحمل");
  assert.equal(item.safeAction, "reserve-and-recalculate-after-birth");
});

test("unknown complex case returns null", () => {
  assert.equal(getComplexFaraidCase("does-not-exist"), null);
});
