const ARABIC_DIACRITICS=/[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const PUNCT=/[؟?!.,،؛:()[\]{}«»"']/g;
export function normalizeResearchQuery(input=""){
 const raw=String(input??"").trim(); if(!raw)return {raw:"",normalized:"",tokens:[],language:"unknown"};
 const normalized=raw.normalize("NFKC").toLocaleLowerCase("ar").replace(ARABIC_DIACRITICS,"").replace(/[إأآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ـ/g,"").replace(PUNCT," ").replace(/\s+/g," ").trim();
 const tokens=[...new Set(normalized.split(" ").filter(Boolean))];
 const arabic=(normalized.match(/[\u0600-\u06FF]/g)||[]).length, latin=(normalized.match(/[A-Za-z]/g)||[]).length;
 return Object.freeze({raw,normalized,tokens,language:arabic>latin?"ar":latin>0?"latin":"unknown"});
}
