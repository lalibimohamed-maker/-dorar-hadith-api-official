export function resolveEvidenceConflicts(claims=[]){
 if(!Array.isArray(claims))throw new TypeError("claims must be an array");
 const groups=new Map(); for(const claim of claims){const key=String(claim.topic??claim.claim_id??claim.id??"unknown").trim();if(!groups.has(key))groups.set(key,[]);groups.get(key).push({...claim});}
 return [...groups.entries()].map(([topic,items])=>{const fingerprints=new Set(items.map(x=>JSON.stringify(x.value??x.text??x.statement??null)));return {topic,status:fingerprints.size>1?"conflict":"consistent",resolution:fingerprints.size>1?"preserve_all_sources":"single_or_equivalent",claims:items};});
}
