import { searchHadith } from './hadith-search.js';
import { buildFinalHadithCard } from './hadith-final-card.js';
import { indexHadithReferences, findHadithByReference } from './hadith-reference-index.js';
export function hadithApi(records = []) {
  const index = indexHadithReferences(records);
  return { search:(q,o)=>searchHadith(records,q,o), byReference:(s,r)=>findHadithByReference(index,s,r), card:(h,rel,a,m)=>buildFinalHadithCard(h,rel,a,m) };
}
