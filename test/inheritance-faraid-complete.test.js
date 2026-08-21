import test from "node:test";
import assert from "node:assert/strict";
import { calculateInheritance } from "../src/inheritance-calculator.js";

test("basic spouse and children case", () => {
  const r = calculateInheritance({ estate: 800000, madhhab: "hanbali", heirs: { husband: 1, sons: 1, daughters: 1 } });
  assert.equal(r.method.awl, false);
  assert.equal(r.allocations.find(x => x.id === "husband").fraction, "1/4");
  assert.equal(r.allocations.find(x => x.id === "sons").amount, 400000);
  assert.equal(r.allocations.find(x => x.id === "daughters").amount, 200000);
});

test("umariyyatan: husband, mother and father", () => {
  const r = calculateInheritance({ estate: 600000, heirs: { husband: 1, mother: 1, father: 1 } });
  assert.equal(r.allocations.find(x => x.id === "husband").fraction, "1/2");
  assert.equal(r.allocations.find(x => x.id === "mother").fraction, "1/6");
  assert.equal(r.allocations.find(x => x.id === "father").fraction, "1/3");
});

test("awl scales fixed shares when they exceed one", () => {
  const r = calculateInheritance({ estate: 120000, heirs: { husband: 1, mother: 1, fullSisters: 2 } });
  assert.equal(r.method.awl, true);
  assert.equal(r.allocations.find(x => x.id === "husband").fraction, "1/3");
  assert.equal(r.allocations.find(x => x.id === "mother").fraction, "2/9");
  assert.equal(r.allocations.find(x => x.id === "fullSisters").fraction, "4/9");
});

test("radd is applied to non-spouse fixed heirs in the simple case", () => {
  const r = calculateInheritance({ estate: 100000, heirs: { mother: 1, daughters: 1 } });
  assert.equal(r.allocations.find(x => x.id === "daughters").fraction, "3/4");
  assert.equal(r.allocations.find(x => x.id === "mother").fraction, "1/4");
  assert.equal(r.method.remainingFraction, "0/1");
});

test("debts and bequest are deducted before distribution", () => {
  const r = calculateInheritance({ estate: 100000, debts: 10000, bequest: 10000, heirs: { sons: 1 } });
  assert.equal(r.deductions.distributable, 80000);
  assert.equal(r.allocations.find(x => x.id === "sons").amount, 80000);
});

test("complex grandfather and descendant cases are never silently guessed", () => {
  const r = calculateInheritance({ estate: 100000, heirs: { grandfather: 1, grandsons: 2, daughters: 1 } });
  assert.ok(r.warnings.some(w => w.includes("الجد")));
  assert.ok(r.warnings.some(w => w.includes("أولاد الابن")));
});

test("all four madhahib are accepted as explicit contexts", () => {
  for (const madhhab of ["hanafi", "maliki", "shafii", "hanbali"]) {
    const r = calculateInheritance({ estate: 1000, madhhab, heirs: { sons: 1 } });
    assert.equal(r.madhhab, madhhab);
  }
});
