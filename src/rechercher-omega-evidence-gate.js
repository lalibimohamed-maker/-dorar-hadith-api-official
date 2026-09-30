import { createHash } from "node:crypto";
const sha256=v=>createHash("sha256").update(String(v??""),"utf8").digest("hex");
export function verifyEvidenceGate({answer="",evidence=[],citations=[],strict=true}={}){
 if(!strict)return Object.freeze({ok:true,mode:"advisory",evidence_count:evidence.length});
 if(!Array.isArray(evidence)||!evidence.length)throw new Error("EVIDENCE_REQUIRED: no retrieved scholarly evidence");
 if(!Array.isArray(citations)||!citations.length)throw new Error("CITATIONS_REQUIRED: generated answer has no deterministic citations");
 const byKey=new Map(evidence.map(e=>[String(e.sourceId)+"|"+String(e.citation),e]));
 for(const c of citations){const key=String(c.sourceId)+"|"+String(c.citation);if(!byKey.has(key))throw new Error("CITATION_NOT_IN_EVIDENCE: "+key);const e=byKey.get(key);if(e.text_hash&&c.text_hash&&e.text_hash!==c.text_hash)throw new Error("EVIDENCE_HASH_MISMATCH: "+key);if(e.text&&c.text_hash&&sha256(e.text)!==c.text_hash)throw new Error("EVIDENCE_TEXT_HASH_MISMATCH: "+key);}
 return Object.freeze({ok:true,mode:"strict",evidence_count:evidence.length,citation_count:citations.length,evidence_hashes:evidence.map(e=>({sourceId:e.sourceId,citation:e.citation,text_hash:e.text_hash??(e.text?sha256(e.text):null)}))});
}
