export function createQdrantVectorWriter({url=process.env.QDRANT_URL,collection=process.env.QDRANT_COLLECTION||"dinullah_corpus",apiKey=process.env.QDRANT_API_KEY,fetchImpl=globalThis.fetch}={}){
  if(!url) return Object.freeze({enabled:false,async upsert(){throw new Error("QDRANT_NOT_CONFIGURED")},async ensureCollection(){throw new Error("QDRANT_NOT_CONFIGURED")}});
  const base=String(url).replace(/\/$/,"");
  const headers={"content-type":"application/json"};
  if(apiKey) headers["api-key"]=apiKey;
  async function request(path,init={}){const r=await fetchImpl(base+path,{...init,headers:{...headers,...init.headers}});if(!r.ok)throw new Error("QDRANT_HTTP_"+r.status);return r.status===204?null:r.json();}
  return Object.freeze({
    enabled:true,
    async ensureCollection({vectorSize,distance="Cosine"}={}){
      return request("/collections/"+encodeURIComponent(collection),{method:"PUT",body:JSON.stringify({vectors:{size:vectorSize,distance}})});
    },
    async upsert({id,vector,payload}={}){
      return request("/collections/"+encodeURIComponent(collection)+"/points?wait=true",{method:"PUT",body:JSON.stringify({points:[{id,vector,payload}]})});
    }
  });
}
