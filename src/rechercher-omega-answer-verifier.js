import { verifyEvidenceGate } from "./rechercher-omega-evidence-gate.js";
import { UnsupportedClaimGate } from "./rechercher-omega-claim-gate.js";

function fallbackText(evidence=[], citations=[]){
  for(const c of citations){
    const item=evidence.find(e=>String(e.sourceId)+"|"+String(e.citation)===String(c.sourceId)+"|"+String(c.citation));
    if(item?.text) return item.text;
    if(item?.text_raw) return item.text_raw;
  }
  return evidence.find(e=>e?.text)?.text ?? evidence.find(e=>e?.text_raw)?.text_raw ?? null;
}

export function verifyAgentAnswer({
  answer="",
  evidence=[],
  citations=[],
  claimProvenance=[]
}={}){
  try{
    const verification=verifyEvidenceGate({answer,evidence,citations,strict:true});
    const claimVerification=UnsupportedClaimGate.verifyClaimCoverage(
      answer,
      evidence,
      claimProvenance
    );

    if(!claimVerification.ok){
      return Object.freeze({
        verified:false,
        verification,
        claimVerification,
        fallback:fallbackText(evidence,citations),
        error:{
          code:claimVerification.rejected[0]?.reason ?? "UNSUPPORTED_CLAIM",
          message:"Claim-level provenance coverage rejected one or more scholarly claims."
        }
      });
    }

    return Object.freeze({
      verified:true,
      verification,
      claimVerification,
      fallback:null,
      error:null
    });
  }catch(error){
    const code=String(error.message||"EVIDENCE_GATE_REJECTED").split(":")[0];
    return Object.freeze({
      verified:false,
      verification:null,
      claimVerification:null,
      fallback:fallbackText(evidence,citations),
      error:{code,message:error.message}
    });
  }
}
