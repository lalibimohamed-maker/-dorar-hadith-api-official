import assert from "node:assert/strict";
import test from "node:test";
import { calculateCashZakat, calculateFitr, calculateKhums } from "../src/zakat-calculator.js";

test("cash zakat is calculated transparently", () => {
  const r = calculateCashZakat({ amount: 10000, nisab: 5000 });
  assert.equal(r.due, 250);
});

test("below nisab has no due zakat in this cash model", () => {
  assert.equal(calculateCashZakat({ amount: 4000, nisab: 5000 }).due, 0);
});

test("fitr calculation keeps the food-unit basis explicit", () => {
  const r = calculateFitr({ people: 4, saWeightKg: 3 });
  assert.equal(r.foodKg, 12);
  assert.equal(r.cashEquivalent, null);
});

test("khums is not silently treated as universal zakat", () => {
  assert.equal(calculateKhums({ base: 10000 }).due, 0);
  assert.equal(calculateKhums({ base: 10000, applicable: true }).due, 2000);
});
