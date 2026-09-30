import { createHash } from "node:crypto";

const ARABIC_LETTER_FORMS = new Map([
  ["\u0622","\u0627\u0653"], // ALEF WITH MADDA -> ALEF + MADDAH
  ["\u0623","\u0627\u0654"], // ALEF WITH HAMZA ABOVE
  ["\u0625","\u0627\u0655"], // ALEF WITH HAMZA BELOW
  ["\u0624","\u0648\u0654"], // WAW WITH HAMZA
  ["\u0626","\u064A\u0654"], // YEH WITH HAMZA
  ["\u0649","\u064A"],       // ALEF MAKSURA -> YEH
  ["\u0629","\u0647"],       // TA MARBUTA is retained separately by exact matcher; mapping is skeleton-only
]);

const TASHKEEL=/[\u064B-\u065F\u0670]/g;
const TATWEEL=/\u0640/g;

export function canonicalArabicText(value){
  return String(value??"").normalize("NFKC").normalize("NFC");
}

export function arabicSkeleton(value){
  let text=canonicalArabicText(value).replace(TATWEEL,"");
  for(const [from,to] of ARABIC_LETTER_FORMS) text=text.split(from).join(to);
  return text.replace(TASHKEEL,"").replace(/[\u06D6-\u06ED]/g,"");
}

export function exactArabicEquivalent(a,b){
  return canonicalArabicText(a)===canonicalArabicText(b);
}

export function skeletonHash(value){
  return createHash("sha256").update(arabicSkeleton(value),"utf8").digest("hex");
}

export function classifyArabicMismatch(expected,actual){
  const exp=canonicalArabicText(expected);
  const got=canonicalArabicText(actual);
  if(exp===got) return "exact";
  if(arabicSkeleton(expected)===arabicSkeleton(actual)) return "orthography-or-diacritic-variant";
  return "substantive-character-difference";
}
