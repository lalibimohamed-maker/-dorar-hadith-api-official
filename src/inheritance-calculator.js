const SUPPORTED_MADHAHIB = ["hanafi", "maliki", "shafii", "hanbali"];

function n(value) {
  const x = Number(value);
  if (!Number.isInteger(x) || x < 0) throw new Error("Heir counts must be non-negative integers");
  return x;
}

function frac(num, den) { return { num, den }; }
function add(a, b) { return frac(a.num * b.den + b.num * a.den, a.den * b.den); }
function sub(a, b) { return frac(a.num * b.den - b.num * a.den, a.den * b.den); }
function mul(a, b) { return frac(a.num * b.num, a.den * b.den); }
function norm(a) { const g = gcd(Math.abs(a.num), a.den); return frac(a.num / g, a.den / g); }
function gcd(a, b) { while (b) [a, b] = [b, a % b]; return a || 1; }
function lcm(a, b) { return Math.abs(a * b) / gcd(a, b); }
function sumShares(items) { return items.reduce((s, x) => add(s, x.share), frac(0, 1)); }

function normalizeInput(input = {}) {
  return {
    madhhab: input.madhhab || "hanbali",
    estate: Number(input.estate || 0),
    debts: Number(input.debts || 0),
    bequest: Number(input.bequest || 0),
    heirs: {
      husband: n(input.heirs?.husband || 0),
      wives: n(input.heirs?.wives || 0),
      father: n(input.heirs?.father || 0),
      mother: n(input.heirs?.mother || 0),
      sons: n(input.heirs?.sons || 0),
      daughters: n(input.heirs?.daughters || 0),
      grandsons: n(input.heirs?.grandsons || 0),
      granddaughters: n(input.heirs?.granddaughters || 0),
      fullBrothers: n(input.heirs?.fullBrothers || 0),
      fullSisters: n(input.heirs?.fullSisters || 0),
      paternalBrothers: n(input.heirs?.paternalBrothers || 0),
      paternalSisters: n(input.heirs?.paternalSisters || 0),
      maternalBrothers: n(input.heirs?.maternalBrothers || 0),
      maternalSisters: n(input.heirs?.maternalSisters || 0),
    },
  };
}

function validate(input) {
  if (!SUPPORTED_MADHAHIB.includes(input.madhhab)) throw new Error(`Unsupported madhhab: ${input.madhhab}`);
  if (!Number.isFinite(input.estate) || input.estate < 0) throw new Error("estate must be a non-negative number");
  if (!Number.isFinite(input.debts) || input.debts < 0) throw new Error("debts must be a non-negative number");
  if (!Number.isFinite(input.bequest) || input.bequest < 0) throw new Error("bequest must be a non-negative number");
  if (input.heirs.husband && input.heirs.wives) throw new Error("A case cannot contain both a husband and wives");
  if (input.heirs.husband > 1) throw new Error("husband must be 0 or 1");
  if (input.heirs.father > 1 || input.heirs.mother > 1) throw new Error("father and mother must be 0 or 1");
  if (input.heirs.wives > 4) throw new Error("wives cannot exceed four");
  const payable = input.estate - input.debts - input.bequest;
  if (payable < 0) throw new Error("debts and bequest exceed the estate");
  return payable;
}

function push(items, id, labelAr, count, share, basis, notes = []) {
  if (!count || share.num <= 0) return;
  items.push({ id, labelAr, count, share: norm(share), basis, notes });
}

/**
 * Core Sunni faraid calculator.
 * It deliberately flags cases where a full madhhab-specific adjudication is required
 * instead of inventing a result. This is a calculation aid, not a fatwa or legal opinion.
 */
export function calculateInheritance(raw = {}) {
  const input = normalizeInput(raw);
  const distributable = validate(input);
  const h = input.heirs;
  const hasDescendants = h.sons + h.daughters + h.grandsons + h.granddaughters > 0;
  const hasMaleDescendant = h.sons + h.grandsons > 0;
  const siblingCount = h.fullBrothers + h.fullSisters + h.paternalBrothers + h.paternalSisters + h.maternalBrothers + h.maternalSisters;
  const blockers = [];
  const results = [];

  if (h.husband) push(results, "husband", "الزوج", 1, hasDescendants ? frac(1,4) : frac(1,2), "Quran 4:12");
  if (h.wives) push(results, "wives", "الزوجات", h.wives, hasDescendants ? frac(1,8) : frac(1,4), "Quran 4:12");

  if (h.mother) {
    let share;
    if (hasDescendants || siblingCount >= 2) share = frac(1,6);
    else if ((h.husband || h.wives) && h.father && !hasDescendants) share = frac(1,3);
    else share = frac(1,3);
    push(results, "mother", "الأم", 1, share, "Quran 4:11", share.num === 1 && share.den === 3 ? ["في بعض مسائل الزوجين والأبوين يراعى ثلث الباقي وفق المسألة المعروفة بالعمريتين."] : []);
  }

  if (h.father && hasDescendants) push(results, "father", "الأب", 1, frac(1,6), "Quran 4:11");

  if (h.sons) {
    push(results, "sons", "الأبناء", h.sons, frac(0,1), "تعصيب بالنفس", ["يأخذون الباقي مع البنات للذكر مثل حظ الأنثيين."]);
  }
  if (h.daughters && h.sons) {
    push(results, "daughters", "البنات", h.daughters, frac(0,1), "تعصيب بالغير", ["مع الأبناء: للذكر مثل حظ الأنثيين."]);
  } else if (h.daughters) {
    push(results, "daughters", "البنات", h.daughters, h.daughters === 1 ? frac(1,2) : frac(2,3), "Quran 4:11");
  }

  if (h.maternalBrothers + h.maternalSisters) {
    if (hasDescendants || h.father) {
      blockers.push("الإخوة لأم محجوبون بالفرع الوارث أو الأب");
    } else {
      const count = h.maternalBrothers + h.maternalSisters;
      push(results, "maternal-siblings", "الإخوة والأخوات لأم", count, count === 1 ? frac(1,6) : frac(1,3), "Quran 4:12", ["الإخوة لأم يشتركون في الثلث بالتساوي عند تعددهم."]);
    }
  }

  const unsupportedComplexity = [];
  if (h.grandsons || h.granddaughters) unsupportedComplexity.push("أولاد الابن مع وجود/عدم وجود أبناء مباشرين تحتاج معالجة تفصيلية للحجب والتعصيب");
  if (h.fullBrothers || h.fullSisters || h.paternalBrothers || h.paternalSisters) unsupportedComplexity.push("تفاصيل الإخوة الأشقاء/لأب مع البنات والجد تحتاج معالجة مذهبية تفصيلية");
  if (h.father && !hasDescendants) unsupportedComplexity.push("الأب في حالة عدم وجود فرع وارث يأخذ الباقي تعصيباً");
  if (h.mother && h.father && (h.husband || h.wives) && !hasDescendants) unsupportedComplexity.push("العمريتان تحتاجان تطبيق قاعدة ثلث الباقي");

  // Allocate zero-share residuaries using the standard common-case ordering.
  let assigned = sumShares(results);
  let remaining = sub(frac(1,1), assigned);
  const residuary = [];
  if (h.sons) residuary.push({ id: "sons", count: h.sons * 2, labelAr: "الأبناء" });
  if (h.daughters && h.sons) residuary.push({ id: "daughters", count: h.daughters, labelAr: "البنات" });
  if (h.father && !hasDescendants) residuary.push({ id: "father", count: 1, labelAr: "الأب" });

  if (residuary.length && remaining.num > 0) {
    const units = residuary.reduce((s, x) => s + x.count, 0);
    for (const r of residuary) {
      const share = mul(remaining, frac(r.count, units));
      const existing = results.find((x) => x.id === r.id);
      if (existing) existing.share = norm(add(existing.share, share));
      else push(results, r.id, r.labelAr, r.count, share, "تعصيب");
    }
    assigned = sumShares(results);
    remaining = sub(frac(1,1), assigned);
  }

  // Radd is deliberately not applied when a spouse is present; exact madhhab handling is flagged.
  if (remaining.num > 0 && !residuary.length) {
    if (h.husband || h.wives) unsupportedComplexity.push("الرد مع وجود الزوج/الزوجات يحتاج اختيار الرأي المذهبي وتفصيله");
    else unsupportedComplexity.push("بقاء جزء من التركة دون عاصب يحتاج تطبيق أحكام الرد/بيت المال بحسب المذهب والحالة");
  }

  const denominator = results.reduce((d, r) => lcm(d, r.share.den), 1);
  const allocations = results.map((r) => {
    const units = r.share.num * (denominator / r.share.den);
    return { ...r, fraction: `${r.share.num}/${r.share.den}`, denominator, units, amount: distributable * r.share.num / r.share.den };
  });

  return {
    calculator: "deen-allah-faraid",
    madhhab: input.madhhab,
    estate: input.estate,
    deductions: { debts: input.debts, bequest: input.bequest, distributable },
    heirs: h,
    allocations,
    remainingFraction: `${remaining.num}/${remaining.den}`,
    blockers,
    warnings: [...new Set(unsupportedComplexity)],
    sources: [
      { reference: "Quran 4:11", titleAr: "آية المواريث", type: "primary" },
      { reference: "Quran 4:12", titleAr: "آية المواريث والزوجين والإخوة لأم", type: "primary" },
      { reference: "Quran 4:176", titleAr: "آية الكلالة", type: "primary" }
    ],
    disclaimerAr: "هذه حاسبة تعليمية للفرائض وليست فتوى ولا بديلاً عن مراجعة عالم أو جهة إفتاء، ولا سيما في المسائل المركبة أو المتنازع فيها أو المتعلقة بالقانون المحلي.",
  };
}

export function supportedMadhahib() { return [...SUPPORTED_MADHAHIB]; }
