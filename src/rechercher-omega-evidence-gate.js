import { createHash } from "node:crypto";

const HEX_SHA256=/^[a-f0-9]{64}$/;

export function sha256(value){
  return createHash("sha256").update(String(value??""),"utf8").digest("hex");
}

function evidenceText(item){
  return typeof item?.text==="string" ? item.text : (typeof item?.text_raw==="string" ? item.text_raw : "");
}

function sourceId(item){
  return item?.sourceId ?? item?.source_id ?? item?.id ?? item?.hadith_id ?? item?.node_id ?? null;
}

function citationKey(item){
  return item?.citation ?? item?.provenance?.citation ?? null;
}

function declaredHash(item){
  return item?.text_hash ?? item?.sha256 ?? null;
}

function ensureHashIntegrity(item,key){
  const text=evidenceText(item);
  const expected=declaredHash(item);

  if(expected!==null && !HEX_SHA256.test(String(expected))){
    throw new Error("INVALID_EVIDENCE_HASH: "+key);
  }

  if(expected!==null && sha256(text)!==String(expected)){
    throw new Error("EVIDENCE_TEXT_HASH_MISMATCH: "+key);
  }

  return text;
}

export function verifyEvidenceGate({
  answer="",
  evidence=[],
  citations=[],
  strict=true
}={}){
  if(!strict) return Object.freeze({
    ok:true,
    mode:"advisory",
    evidence_count:Array.isArray(evidence)?evidence.length:0
  });

  if(typeof answer!=="string") throw new TypeError("answer must be a string");
  if(!Array.isArray(evidence) || evidence.length===0){
    throw new Error("NO_EVIDENCE_FOUND: no retrieved scholarly evidence");
  }
  if(!Array.isArray(citations) || citations.length===0){
    throw new Error("CITATIONS_REQUIRED: generated answer has no deterministic citations");
  }

  const byKey=new Map();
  for(const item of evidence){
    const id=sourceId(item);
    const citation=citationKey(item);
    if(!id || !citation) continue;
    byKey.set(String(id)+"|"+String(citation),item);
  }

  for(const citation of citations){
    const id=citation?.sourceId ?? citation?.source_id ?? null;
    const location=citation?.citation ?? null;
    const key=String(id)+"|"+String(location);
    const item=byKey.get(key);

    if(!item) throw new Error("CITATION_NOT_IN_EVIDENCE: "+key);

    const expected=ensureHashIntegrity(item,key);
    if(!expected){
      throw new Error("EVIDENCE_TEXT_MISSING: "+key);
    }

    const citedHash=citation?.text_hash ?? null;
    if(citedHash!==null && String(citedHash)!==sha256(expected)){
      throw new Error("CITED_TEXT_HASH_MISMATCH: "+key);
    }

    if(item.exact_quote_required || item.kind==="primary_text" || item.category==="quran"){
      if(!answer.includes(expected)){
        throw new Error("STRICT_ALIGNMENT_MISMATCH: cited source text is not present byte-for-byte in answer: "+key);
      }
      if(citation?.cited_text!==undefined && String(citation.cited_text)!==expected){
        throw new Error("CITED_TEXT_MISMATCH: "+key);
      }
    }
  }

  return Object.freeze({
    ok:true,
    mode:"strict",
    evidence_count:evidence.length,
    citation_count:citations.length,
    evidence_hashes:evidence.map(item=>({
      sourceId:sourceId(item),
      citation:citationKey(item),
      text_hash:declaredHash(item) ?? (evidenceText(item)?sha256(evidenceText(item)):null)
    }))
  });
}
