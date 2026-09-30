import { createHash } from "node:crypto";

const sha256=value=>createHash("sha256").update(String(value??""),"utf8").digest("hex");

export function verifyEvidenceGate({answer="",evidence=[],citations=[],strict=true}={}){
  if(!strict) return Object.freeze({ok:true,mode:"advisory",evidence_count:evidence.length});
  if(typeof answer!=="string") throw new TypeError("answer must be a string");
  if(!Array.isArray(evidence)||!evidence.length) throw new Error("NO_EVIDENCE_FOUND: no retrieved scholarly evidence");
  if(!Array.isArray(citations)||!citations.length) throw new Error("CITATIONS_REQUIRED: generated answer has no deterministic citations");

  const byKey=new Map(evidence.map(e=>[String(e.sourceId)+"|"+String(e.citation),e]));
  for(const citation of citations){
    const key=String(citation.sourceId)+"|"+String(citation.citation);
    const item=byKey.get(key);
    if(!item) throw new Error("CITATION_NOT_IN_EVIDENCE: "+key);

    if(item.text_hash && citation.text_hash && item.text_hash!==citation.text_hash) throw new Error("EVIDENCE_HASH_MISMATCH: "+key);
    if(item.text && citation.text_hash && sha256(item.text)!==citation.text_hash) throw new Error("EVIDENCE_TEXT_HASH_MISMATCH: "+key);

    if(item.exact_quote_required || item.kind==="primary_text"){
      const expected=String(item.text??"");
      if(!expected || !answer.includes(expected)) throw new Error("STRICT_ALIGNMENT_MISMATCH: cited source text is not present byte-for-character in answer: "+key);
      if(citation.cited_text!==undefined && String(citation.cited_text)!==expected) throw new Error("CITED_TEXT_MISMATCH: "+key);
    }
  }

  return Object.freeze({
    ok:true,
    mode:"strict",
    evidence_count:evidence.length,
    citation_count:citations.length,
    evidence_hashes:evidence.map(e=>({sourceId:e.sourceId,citation:e.citation,text_hash:e.text_hash??(e.text?sha256(e.text):null)}))
  });
}
