import { FARAID_SOURCES, MADHHAB_NOTES } from "./faraid-rules.js";

export const SUPPORTED_MADHAHIB = ["hanafi", "maliki", "shafii", "hanbali"];

const f = (num, den = 1) => ({ num, den });
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
const norm = a => { const g = gcd(a.num, a.den); return f(a.num / g, a.den / g); };
const add = (a, b) => norm(f(a.num * b.den + b.num * a.den, a.den * b.den));
const sub = (a, b) => norm(f(a.num * b.den - b.num * a.den, a.den * b.den));
const mul = (a, b) => norm(f(a.num * b.num, a.den * b.den));
const gt = (a, b) => a.num * b.den > b.num * a.den;
const eq = (a, b) => a.num * b.den === b.num * a.den;
const zero = () => f(0, 1);

function count(value, name) {
  const n = Number(value ?? 0);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be a non-negative integer`);
  return n;
}

function normalizeInput(input = {}) {
  return {
    madhhab: input.madhhab || "hanbali",
    estate: Number(input.estate ?? 0),
    debts: Number(input.debts ?? 0),
    bequest: Number(input.bequest ?? 0),
    heirs: Object.fromEntries([
      "husband","wives","father","mother","sons","daughters","grandfather","grandmothers",
      "grandsons","granddaughters","fullBrothers","fullSisters","paternalBrothers","paternalSisters",
      "maternalBrothers","maternalSisters"
    ].map(k => [k, count(input.heirs?.[k], `heirs.${k}`)]))
  };
}

function validate(x) {
  if (!SUPPORTED_MADHAHIB.includes(x.madhhab)) throw new Error(`Unsupported madhhab: ${x.madhhab}`);
  for (const [k, v] of Object.entries({ estate:x.estate, debts:x.debts, bequest:x.bequest })) {
    if (!Number.isFinite(v) || v < 0) throw new Error(`${k} must be a non-negative number`);
  }
  const h = x.heirs;
  if (h.husband && h.wives) throw new Error("A case cannot contain both husband and wives");
  if (h.husband > 1 || h.father > 1 || h.mother > 1 || h.grandfather > 1) throw new Error("single-person heirs must be 0 or 1");
  if (h.wives > 4) throw new Error("wives cannot exceed four");
  const distributable = x.estate - x.debts - x.bequest;
  if (distributable < 0) throw new Error("debts and bequest exceed the estate");
  return distributable;
}

function item(id, labelAr, countValue, share, basis, notes = [], role = "fixed") {
  return { id, labelAr, count: countValue, share: norm(share), basis, notes, role };
}

function sum(items) { return items.reduce((s, x) => add(s, x.share), zero()); }

function hasDirectDesc(h) { return h.sons + h.daughters > 0; }
function hasAnyDesc(h) { return hasDirectDesc(h) || h.grandsons + h.granddaughters > 0; }
function siblingCount(h) { return h.fullBrothers+h.fullSisters+h.paternalBrothers+h.paternalSisters+h.maternalBrothers+h.maternalSisters; }

function pushFixed(items, id, label, c, share, basis, notes=[]) {
  if (c) items.push(item(id,label,c,share,basis,notes,"fixed"));
}

/**
 * Faraid engine for the common Sunni cases, with explicit awl, radd and correction.
 * Complex edge cases are never guessed: they are returned as warnings for scholarly review.
 */
export function calculateInheritance(raw = {}) {
  const input = normalizeInput(raw);
  const distributable = validate(input);
  const h = input.heirs;
  const descendants = hasAnyDesc(h);
  const directDesc = hasDirectDesc(h);
  const warnings = [];
  const blockers = [];
  const fixed = [];
  const residuaryCandidates = [];

  if (h.husband) pushFixed(fixed,"husband","الزوج",1, descendants ? f(1,4) : f(1,2),"Qur'an 4:12");
  if (h.wives) pushFixed(fixed,"wives","الزوجات",h.wives, descendants ? f(1,8) : f(1,4),"Qur'an 4:12");

  const maternalMultiple = h.maternalBrothers + h.maternalSisters >= 2;
  const umariyya = h.mother && h.father && !descendants && (h.husband || h.wives);
  if (h.mother) {
    const share = descendants || siblingCount(h) >= 2 ? f(1,6) : (umariyya ? f(1,3) : f(1,3));
    pushFixed(fixed,"mother","الأم",1,share,"Qur'an 4:11",umariyya ? ["العمريتان: ثلث الباقي بعد فرض الزوج/الزوجة في الصورة المعروفة."] : []);
  }

  if (h.father && directDesc) {
    pushFixed(fixed,"father","الأب",1,f(1,6),"Qur'an 4:11");
    if (h.daughters && !h.sons) residuaryCandidates.push({ id:"father", count:1, labelAr:"الأب", role:"father-after-female-descendants" });
  } else if (h.father && !descendants) {
    residuaryCandidates.push({ id:"father", count:1, labelAr:"الأب", role:"residuary" });
  }

  if (h.sons) {
    residuaryCandidates.push({ id:"sons", count:h.sons*2, labelAr:"الأبناء", role:"descendant-male" });
    if (h.daughters) residuaryCandidates.push({ id:"daughters", count:h.daughters, labelAr:"البنات", role:"descendant-female" });
  } else if (h.daughters) {
    pushFixed(fixed,"daughters","البنات",h.daughters,h.daughters===1?f(1,2):f(2,3),"Qur'an 4:11");
  }

  // Maternal siblings: simple Qur'anic cases only.
  if (h.maternalBrothers + h.maternalSisters) {
    if (descendants || h.father || h.grandfather) blockers.push("الإخوة لأم محجوبون بوجود الفرع الوارث أو الأب/الجد في هذه الصورة.");
    else pushFixed(fixed,"maternal-siblings","الإخوة والأخوات لأم",h.maternalBrothers+h.maternalSisters,
      maternalMultiple?f(1,3):f(1,6),"Qur'an 4:12",maternalMultiple?["عند التعدد يكون الثلث بينهم بالسوية."]:[]);
  }

  // Full/paternal siblings in the common kalalah cases.
  if (!h.father && !descendants && (h.fullBrothers || h.fullSisters)) {
    if (h.fullBrothers) {
      residuaryCandidates.push({ id:"fullBrothers", count:h.fullBrothers*2, labelAr:"الإخوة الأشقاء", role:"sibling-male" });
      if (h.fullSisters) residuaryCandidates.push({ id:"fullSisters", count:h.fullSisters, labelAr:"الأخوات الشقيقات", role:"sibling-female" });
    } else {
      pushFixed(fixed,"fullSisters","الأخوات الشقيقات",h.fullSisters,h.fullSisters===1?f(1,2):f(2,3),"Qur'an 4:176");
    }
  } else if (h.fullBrothers || h.fullSisters) {
    warnings.push("وجود الإخوة الأشقاء مع الأب أو الفرع الوارث يحتاج تفصيلاً للحجب والتعصيب.");
  }

  if (!h.father && !h.grandfather && !descendants && !h.fullBrothers && !h.fullSisters && (h.paternalBrothers || h.paternalSisters)) {
    if (h.paternalBrothers) {
      residuaryCandidates.push({ id:"paternalBrothers", count:h.paternalBrothers*2, labelAr:"الإخوة لأب", role:"sibling-male" });
      if (h.paternalSisters) residuaryCandidates.push({ id:"paternalSisters", count:h.paternalSisters, labelAr:"الأخوات لأب", role:"sibling-female" });
    } else {
      pushFixed(fixed,"paternalSisters","الأخوات لأب",h.paternalSisters,h.paternalSisters===1?f(1,2):f(2,3),"أحكام الفرائض",["هذه الصورة مبنية على عدم وجود الشقيقات/الإخوة الأشقاء والحجب المؤثر."]);
    }
  } else if (h.paternalBrothers || h.paternalSisters) {
    warnings.push("وجود الإخوة لأب مع الورثة الآخرين يحتاج تفصيلاً للحجب.");
  }

  if (h.grandsons || h.granddaughters) warnings.push("أولاد الابن تحتاج أحكام الحجب والتعصيب التفصيلية؛ لا تُستنتج من مجرد وجود الأبناء.");
  if (h.grandfather || h.grandmothers) warnings.push("مسائل الجد/الجدات تحتاج تفصيلاً مذهبياً ولا تُحسم هنا آلياً.");

  // Umariyyatan: replace mother's ordinary 1/3 with one-third of residue after spouse.
  if (umariyya) {
    const spouse = fixed.find(x => x.id === "husband" || x.id === "wives");
    const spouseShare = spouse?.share || zero();
    const mother = fixed.find(x => x.id === "mother");
    if (mother) mother.share = norm(mul(sub(f(1,1), spouseShare), f(1,3)));
  }

  let totalFixed = sum(fixed);
  let awl = false;
  let awlFactor = f(1,1);
  if (gt(totalFixed,f(1,1))) {
    awl = true;
    awlFactor = norm(f(totalFixed.den,totalFixed.num));
    for (const x of fixed) x.share = norm(mul(x.share, awlFactor));
    totalFixed = sum(fixed);
  }

  let remaining = sub(f(1,1), totalFixed);
  const allocations = [...fixed];
  let correction = null;

  if (residuaryCandidates.length && gt(remaining,zero())) {
    const units = residuaryCandidates.reduce((s,x)=>s+x.count,0);
    for (const r of residuaryCandidates) {
      allocations.push(item(r.id,r.labelAr,r.count, mul(remaining,f(r.count,units)), "تعصيب", ["يأخذ من الباقي بعد أصحاب الفروض."], "residuary"));
    }
    remaining = zero();
  }

  // Radd: apply to non-spouse fixed heirs when there is no residuary. We deliberately
  // expose the spouse treatment as a madhhab-sensitive warning instead of guessing.
  if (gt(remaining,zero()) && fixed.length) {
    const eligible = allocations.filter(x => x.role === "fixed" && x.id !== "husband" && x.id !== "wives");
    const eligibleTotal = sum(eligible);
    if (gt(eligibleTotal,zero())) {
      for (const x of eligible) x.share = norm(mul(x.share, f(remaining.num + eligibleTotal.num*remaining.den, remaining.den*eligibleTotal.den)));
      // The multiplier above is (eligible + remaining) / eligible.
      remaining = zero();
      warnings.push("طُبِّق الرد على أصحاب الفروض غير الزوجين/الزوجة في الصورة البسيطة؛ مسائل الرد على الزوجين قد تختلف باختلاف المذهب والتفصيل.");
    } else {
      warnings.push("بقي فاضل لا عاصب له؛ يلزم تفصيل حكم الرد وبيت المال بحسب المذهب والاختصاص القضائي.");
    }
  }

  // Convert fractions to a common denominator and detect correction need.
  let denominator = 1;
  for (const x of allocations) denominator = lcm(denominator,x.share.den);
  const unitTotals = allocations.map(x => x.share.num * (denominator/x.share.den));
  const integerCounts = allocations.map((x,i) => x.count ? unitTotals[i] % x.count === 0 : true);
  if (integerCounts.some(v=>!v)) {
    let correctionFactor = 1;
    for (const x of allocations) correctionFactor = lcm(correctionFactor, x.count ? x.count / gcd(unitTotals[allocations.indexOf(x)],x.count) : 1);
    denominator *= correctionFactor;
    correction = { originalDenominator: denominator / correctionFactor, factor: correctionFactor, correctedDenominator: denominator };
  }

  const finalTotal = sum(allocations);
  if (!eq(finalTotal,f(1,1))) warnings.push(`مجموع الأنصبة النهائي ${finalTotal.num}/${finalTotal.den} وليس 1؛ يلزم مراجعة علمية قبل الاعتماد.`);
  if (awl) warnings.unshift("هذه مسألة عَول: خُفِّضت الأنصبة بنسبة مشتركة لأن مجموع الفروض تجاوز أصل المسألة.");

  return {
    calculator:"deen-allah-faraid",
    madhhab:input.madhhab,
    madhhabNote:MADHHAB_NOTES[input.madhhab],
    estate:input.estate,
    deductions:{debts:input.debts,bequest:input.bequest,distributable},
    heirs:h,
    method:{awl,awlFactor,remainingFraction:`${remaining.num}/${remaining.den}`,correction},
    allocations:allocations.map(x=>({
      id:x.id,labelAr:x.labelAr,count:x.count,role:x.role,fraction:`${x.share.num}/${x.share.den}`,
      denominator,units:x.share.num*(denominator/x.share.den),amount:distributable*x.share.num/x.share.den,basis:x.basis,notes:x.notes
    })),
    blockers,
    warnings:[...new Set(warnings)],
    sources:FARAID_SOURCES,
    disclaimerAr:"هذه حاسبة تعليمية للفرائض وليست فتوى ولا بديلاً عن مراجعة عالم أو جهة إفتاء، ولا سيما في المسائل المركبة أو المختلف فيها أو المرتبطة بالقانون المحلي."
  };
}

export function supportedMadhahib(){return [...SUPPORTED_MADHAHIB];}
