import { createHash } from "node:crypto";
import { createGraph, addNode, addEdge, addEvidence, snapshotGraph } from "./deen-graph-runtime.js";

const digest=v=>createHash("sha256").update(String(v??""),"utf8").digest("hex");
const stableId=(kind,value)=>kind+":"+digest(value).slice(0,32);

function normalizeRecord(record={}){
  const text=String(record.text??record.text_raw??record.content??record.excerpt??"");
  const sourceId=record.sourceId??record.source_id??record.provenance?.sourceId??record.provenance?.source_id;
  const citation=record.citation??record.provenance?.citation;
  if(!sourceId||!citation) throw new Error("GraphRAG record requires sourceId and citation");
  return {
    id:record.id??record.node_id??stableId("DOC",sourceId+"|"+citation+"|"+text),
    type:record.type??"source",
    text,
    sourceId:String(sourceId),
    citation:String(citation),
    verificationState:record.verificationState??record.verification?.state??"source_verified",
    provenance:record.provenance??{sourceId,citation},
    language:record.language??null,
    rights_status:record.rights_status??record.rights??"unknown",
    sha256:record.sha256??(text?digest(text):null)
  };
}

export function createInMemoryVectorStore(){
  const rows=new Map();
  return {
    async upsert(items=[]){ for(const item of items) rows.set(item.id,{...item}); return {count:items.length}; },
    async search(vector,{limit=8}={}){
      // Deterministic fallback for tests/local boot: lexical overlap replaces semantic
      // similarity until a real embedding+vector backend is supplied.
      const q=Array.isArray(vector)?vector.map(String).join(" "):String(vector??"").toLowerCase();
      const terms=q.toLowerCase().split(/\s+/).filter(Boolean);
      return [...rows.values()].map(item=>{
        const hay=String(item.text??"").toLowerCase();
        const score=terms.length?terms.reduce((n,t)=>n+(hay.includes(t)?1:0),0)/terms.length:0;
        return {...item,score};
      }).sort((a,b)=>b.score-a.score).slice(0,limit);
    },
    size(){return rows.size;}
  };
}

export function createQdrantVectorStore({url=process.env.QDRANT_URL,collection="dinullah_corpus",apiKey=process.env.QDRANT_API_KEY,fetchImpl=globalThis.fetch}={}){
  if(!url) throw new Error("QDRANT_URL is required for Qdrant runtime");
  const base=String(url).replace(/\/$/,"");
  const headers={"content-type":"application/json","accept":"application/json",...(apiKey?{"api-key":apiKey}:{})};
  async function request(path,options={}){
    const response=await fetchImpl(base+path,{...options,headers:{...headers,...(options.headers||{})}});
    if(!response.ok) throw new Error("QDRANT_HTTP_"+response.status);
    return response.status===204?null:response.json();
  }
  return {
    async ensureCollection(size,distance="Cosine"){
      try{return await request("/collections/"+encodeURIComponent(collection),{method:"PUT",body:JSON.stringify({vectors:{size,distance}})});}
      catch(error){ if(!String(error.message).includes("409")) throw error; return null; }
    },
    async upsert(items=[]){
      return request("/collections/"+encodeURIComponent(collection)+"/points?wait=true",{method:"PUT",body:JSON.stringify({points:items})});
    },
    async search(vector,{limit=8,filter=null}={}){
      const data=await request("/collections/"+encodeURIComponent(collection)+"/points/search",{method:"POST",body:JSON.stringify({vector,limit,with_payload:true,filter})});
      return data?.result??[];
    }
  };
}

export function createGraphRagRuntime({embeddingProvider=null,vectorStore=createInMemoryVectorStore(),graph=createGraph(),batchSize=64}={}){
  if(!vectorStore||typeof vectorStore.upsert!=="function"||typeof vectorStore.search!=="function") throw new TypeError("vectorStore.upsert/search required");
  if(!Number.isInteger(batchSize)||batchSize<1) throw new RangeError("batchSize must be >=1");

  async function ingestBatch(records){
    const vectors=[];
    for(const raw of records){
      const record=normalizeRecord(raw);
      if(!graph.nodes.has(record.id)){
        addNode(graph,{id:record.id,type:record.type,provenance:record.provenance,text_hash:record.sha256,language:record.language,rights_status:record.rights_status});
        addEvidence(graph,{nodeId:record.id,evidence:{sourceId:record.sourceId,citation:record.citation,verificationState:record.verificationState}});
      }
      if(embeddingProvider){
        if(typeof embeddingProvider.embed!=="function") throw new TypeError("embeddingProvider.embed required");
        const vector=await embeddingProvider.embed(record.text,{id:record.id,language:record.language});
        vectors.push({id:record.id,vector,payload:{text:record.text,sourceId:record.sourceId,citation:record.citation,verificationState:record.verificationState,rights_status:record.rights_status,sha256:record.sha256,provenance:record.provenance}});
      }else{
        vectors.push({id:record.id,text:record.text,sourceId:record.sourceId,citation:record.citation,verificationState:record.verificationState,rights_status:record.rights_status,sha256:record.sha256,provenance:record.provenance});
      }
    }
    await vectorStore.upsert(vectors);
    return {records:records.length,graphNodes:graph.nodes.size,vectorCount:vectors.length};
  }

  return Object.freeze({
    graph,
    async ingestRecords(records=[]){
      if(!Array.isArray(records)) throw new TypeError("records must be an array");
      let total=0;
      for(let i=0;i<records.length;i+=batchSize){const b=records.slice(i,i+batchSize);const out=await ingestBatch(b);total+=out.records;}
      return {ingested:total,graphNodes:graph.nodes.size};
    },
    async ingestIterable(iterable){
      let batch=[],total=0;
      for await(const record of iterable){batch.push(record);if(batch.length>=batchSize){const out=await ingestBatch(batch);total+=out.records;batch=[];}}
      if(batch.length){const out=await ingestBatch(batch);total+=out.records;}
      return {ingested:total,graphNodes:graph.nodes.size};
    },
    async search(query,{limit=8,filter=null}={}){
      if(!String(query??"").trim()) return [];
      const vector=embeddingProvider?await embeddingProvider.embed(String(query),{query:true}):String(query);
      const hits=await vectorStore.search(vector,{limit,filter});
      return hits.map(hit=>({...hit,graphNode:graph.nodes.get(String(hit.id))??null}));
    },
    snapshot(){return snapshotGraph(graph);}
  });
}
