export function createQdrantVectorWriter({url=process.env.QDRANT_URL,collection=process.env.QDRANT_COLLECTION||"dinullah_corpus",apiKey=process.env.QDRANT_API_KEY,fetchImpl=globalThis.fetch}={}){
  if(!url) return Object.freeze({
    enabled:false,
    async upsert(){throw new Error("QDRANT_NOT_CONFIGURED")},
    async ensureCollection(){throw new Error("QDRANT_NOT_CONFIGURED")},
    async search(){throw new Error("QDRANT_NOT_CONFIGURED")}
  });
  const base=String(url).replace(/\/$/,"");
  const headers={"content-type":"application/json"};
  if(apiKey) headers["api-key"]=apiKey;
  async function request(path,init={}){
    const r=await fetchImpl(base+path,{...init,headers:{...headers,...init.headers}});
    if(!r.ok) throw new Error("QDRANT_HTTP_"+r.status);
    return r.status===204?null:r.json();
  }
  const collectionPath="/collections/"+encodeURIComponent(collection);
  return Object.freeze({
    enabled:true,
    async ensureCollection({vectorSize,distance="Cosine"}={}){
      return request(collectionPath,{method:"PUT",body:JSON.stringify({vectors:{size:vectorSize,distance}})});
    },
    async upsert({id,vector,payload}={}){
      return request(collectionPath+"/points?wait=true",{method:"PUT",body:JSON.stringify({points:[{id,vector,payload}]})});
    },
    async search({vector,limit=10,offset=0,filter=null,scoreThreshold=null}={}){
      if(!Array.isArray(vector)||!vector.length) throw new TypeError("vector is required");
      const body={query:vector,limit:Math.max(1,Math.min(100,Number(limit)||10)),offset:Math.max(0,Number(offset)||0),with_payload:true};
      if(filter) body.filter=filter;
      if(scoreThreshold!==null&&scoreThreshold!==undefined) body.score_threshold=Number(scoreThreshold);
      const response=await request(collectionPath+"/points/query",{method:"POST",body:JSON.stringify(body)});
      return response?.result?.points ?? [];
    }
  });
}
