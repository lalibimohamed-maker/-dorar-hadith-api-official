import { verifyEvidenceGate } from "./rechercher-omega-evidence-gate.js";

function fallbackText(evidence=[], citations=[]){
  for(const c of citations){
    const item=evidence.find(e=>String(e.sourceId)+"|"+String(e.citation)===String(c.sourceId)+"|"+String(c.citation));
    if(item?.text) return item.text;
  }
  return evidence.find(e=>e?.text)?.text ?? null;
}

export function verifyAgentAnswer({answer="",evidence=[],citations=[]}={}){
  try{
    const verification=verifyEvidenceGate({answer,evidence,citations,strict:true});
    return Object.freeze({verified:true,verification,fallback:null,error:null});
  }catch(error){
    const code=String(error.message||"EVIDENCE_GATE_REJECTED").split(":")[0];
    return Object.freeze({
      verified:false,
      verification:null,
      fallback:fallbackText(evidence,citations),
      error:{code,message:error.message}
    });
  }
}
