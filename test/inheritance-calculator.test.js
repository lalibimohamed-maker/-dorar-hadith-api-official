import test from "node:test";
import assert from "node:assert/strict";
import { calculateInheritance } from "../src/inheritance-calculator.js";

test("husband and one daughter: fixed shares are calculated", () => {
  const result = calculateInheritance({ estate: 100000, heirs: { husband: 1, daughters: 1 } });
  const husband = result.allocations.find((x) => x.id === "husband");
  const daughter = result.allocations.find((x) => x.id === "daughters");
  assert.equal(husband.fraction, "1/4");
  assert.equal(daughter.fraction, "1/2");
  assert.equal(husband.amount, 25000);
  assert.equal(daughter.amount, 50000);
});

test("one son and one daughter share the residuary 2:1", () => {
  const result = calculateInheritance({ estate: 90000, heirs: { sons: 1, daughters: 1 } });
  const son = result.allocations.find((x) => x.id === "sons");
  const daughter = result.allocations.find((x) => x.id === "daughters");
  assert.equal(son.amount, 60000);
  assert.equal(daughter.amount, 30000);
});

test("debts and bequest are deducted before distribution", () => {
  const result = calculateInheritance({ estate: 100000, debts: 10000, bequest: 10000, heirs: { sons: 1 } });
  const son = result.allocations.find((x) => x.id === "sons");
  assert.equal(result.deductions.distributable, 80000);
  assert.equal(son.amount, 80000);
});

test("four Sunni madhhabs are accepted as calculation contexts", () => {
  for (const madhhab of ["hanafi", "maliki", "shafii", "hanbali"]) {
    const result = calculateInheritance({ madhhab, estate: 100000, heirs: { sons: 1 } });
    assert.equal(result.madhhab, madhhab);
  }
});

test("complex cases are flagged instead of silently guessed", () => {
  const result = calculateInheritance({ estate: 100000, heirs: { fullBrothers: 1, fullSisters: 1 } });
  assert.ok(result.warnings.length > 0);
});
