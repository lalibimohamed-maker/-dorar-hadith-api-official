export function calculateCashZakat({ amount, nisab, rate = 0.025, eligible = true }) {
  if (!Number.isFinite(amount) || !Number.isFinite(nisab)) throw new Error("amount and nisab must be numbers");
  if (!eligible || amount < nisab) return { due: 0, formula: "0", eligible: false };
  const due = amount * rate;
  return { due, formula: `${amount} × ${rate} = ${due}`, eligible: true };
}

export function calculateFitr({ people, saWeightKg, valuePerKg = null }) {
  if (!Number.isInteger(people) || people < 0 || !Number.isFinite(saWeightKg) || saWeightKg <= 0) throw new Error("invalid fitr inputs");
  const foodKg = people * saWeightKg;
  return {
    people,
    foodKg,
    cashEquivalent: valuePerKg == null ? null : foodKg * valuePerKg,
    formula: `${people} × ${saWeightKg} kg = ${foodKg} kg`,
    sourcePolicy: "sa-of-food; cash equivalent requires a separately selected scholarly ruling"
  };
}

export function calculateKhums({ base, rate = 0.2, applicable = false }) {
  if (!Number.isFinite(base)) throw new Error("base must be a number");
  if (!applicable) return { due: 0, formula: "0", applicable: false };
  const due = base * rate;
  return { due, formula: `${base} × ${rate} = ${due}`, applicable: true };
}
