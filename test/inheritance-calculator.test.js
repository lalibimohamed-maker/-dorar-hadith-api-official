import test from "node:test";
import assert from "node:assert/strict";
import { calculateInheritance } from "../src/inheritance-calculator.js";

test("husband and one daughter: fixed share plus radd are calculated", () => {
  const result = calculateInheritance({ estate: 100000, heirs: { husband: 1, daughters: 1 } });
  const husband = result.allocations.find((x) => x.id === "husband");
  const daughter = result.allocations.find((x) => x.id === "daughters");
  assert.equal(husband.fraction, "1/4");
  assert.equal(daughter.fraction, "3/4");
  assert.equal(husband.amount, 25000);
  assert.equal(daughter.amount, 75000);
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

test("awl: husband with two full sisters reduces shares proportionally", () => {
  const result = calculateInheritance({ estate: 70000, heirs: { husband: 1, fullSisters: 2 } });
  const husband = result.allocations.find((x) => x.id === "husband");
  const sisters = result.allocations.find((x) => x.id === "fullSisters");
  assert.equal(result.method.awl, true);
  assert.equal(husband.fraction, "3/7");
  assert.equal(sisters.fraction, "4/7");
  assert.equal(husband.amount, 30000);
  assert.equal(sisters.amount, 40000);
});

test("radd: mother and one daughter receive the residue when there is no residuary", () => {
  const result = calculateInheritance({ estate: 100000, heirs: { mother: 1, daughters: 1 } });
  const mother = result.allocations.find((x) => x.id === "mother");
  const daughter = result.allocations.find((x) => x.id === "daughters");
  assert.equal(mother.fraction, "1/4");
  assert.equal(daughter.fraction, "3/4");
  assert.equal(mother.amount, 25000);
  assert.equal(daughter.amount, 75000);
});

test("umariyya: mother receives one-third of the residue with husband, mother and father", () => {
  const result = calculateInheritance({ estate: 120000, heirs: { husband: 1, mother: 1, father: 1 } });
  const husband = result.allocations.find((x) => x.id === "husband");
  const mother = result.allocations.find((x) => x.id === "mother");
  const father = result.allocations.find((x) => x.id === "father");
  assert.equal(husband.fraction, "1/2");
  assert.equal(mother.fraction, "1/6");
  assert.equal(father.fraction, "1/3");
  assert.equal(husband.amount, 60000);
  assert.equal(mother.amount, 20000);
  assert.equal(father.amount, 40000);
});

test("complex cases are flagged instead of silently guessed", () => {
  const result = calculateInheritance({ estate: 100000, heirs: { fullBrothers: 1, fullSisters: 1 } });
  assert.ok(result.warnings.length > 0);
});
