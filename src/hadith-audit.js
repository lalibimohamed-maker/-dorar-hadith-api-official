export function auditHadithRecord(record = {}) {
  const required = ['hadithId','sourceId','reference'];
  const missing = required.filter((k)=>!record[k]);
  const chain = Array.isArray(record.chain) && record.chain.length > 0;
  return { hadithId:record.hadithId||null, validMetadata:missing.length===0, hasChain:chain, missing, aiRequired:false };
}
export function auditHadithCollection(records=[]) { return records.map(auditHadithRecord); }
