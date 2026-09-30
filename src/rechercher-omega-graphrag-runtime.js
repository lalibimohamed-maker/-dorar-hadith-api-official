import { createHash } from "node:crypto";

function hash(value){return createHash("sha256").update(String(value??""),"utf8").digest("hex");}

function sourceId(record){
  return String(record.provenance?.sourceId ?? record.sourceId ?? record.provenance?.book_id ?? record.book_id ?? "");
}
function citation(record){
  return String(record.provenance?.citation ?? record.citation ?? "");
}

function toNode(record){
  const id=String(record.node_id ?? record.id ?? hash(JSON.stringify({kind:record.category??record.type,text:record.text_raw??record.text,source:sourceId(record)})));
  const text=String(record.text_raw ?? record.text ?? "");
  if(!sourceId(record) || !citation(record)) throw new TypeError("Corpus record requires source provenance");
  return {
    id,
    type:String(record.category ?? record.type ?? "source"),
    text_raw:text,
    text_hash:hash(text),
    provenance:structuredClone(record.provenance ?? {sourceId:sourceId(record),citation:citation(record)})
  };
}

export async function indexCorpusToGraphRag(records=[],{embedder,graphWriter,vectorWriter,batchSize=32,strict=true}={}){
  if(!Array.isArray(records)) throw new TypeError("records must be an array");
  if(!graphWriter || typeof graphWriter.upsertNode!=="function" || typeof graphWriter.upsertEdge!=="function") throw new TypeError("graphWriter is incomplete");
  if(!vectorWriter || typeof vectorWriter.upsert!=="function") throw new TypeError("vectorWriter is incomplete");
  if(!embedder || typeof embedder.embed!=="function") throw new TypeError("embedder is incomplete");
  const nodes=[],vectors=[];
  for(let i=0;i<records.length;i+=batchSize){
    const batch=records.slice(i,i+batchSize);
    for(const record of batch){
      const node=toNode(record);
      const vector=await embedder.embed(node.text_raw,{nodeId:node.id,sourceId:sourceId(record),citation:citation(record)});
      if(!Array.isArray(vector)||!vector.length) throw new Error("EMPTY_EMBEDDING: "+node.id);
      await graphWriter.upsertNode(node);
      await vectorWriter.upsert({id:node.id,vector,payload:{text_hash:node.text_hash,provenance:node.provenance}});
      nodes.push(node); vectors.push({id:node.id,dimensions:vector.length});
      if(record.links && Array.isArray(record.links)){
        for(const link of record.links){
          if(!link.to || !link.type) continue;
          await graphWriter.upsertEdge({
            id:String(link.id ?? hash(node.id+"|"+link.type+"|"+link.to)),
            from:node.id,to:String(link.to),type:String(link.type),
            provenance:structuredClone(link.provenance ?? node.provenance)
          });
        }
      }
    }
  }
  if(strict && nodes.length!==records.length) throw new Error("GRAPH_RAG_INDEX_COUNT_MISMATCH");
  return Object.freeze({indexedRecords:nodes.length,graphNodes:nodes.length,vectorPoints:vectors.length,vectorDimensions:vectors[0]?.dimensions??0,corpusWrite:false});
}

export function createMemoryGraphWriter(){
  const nodes=new Map(), edges=new Map();
  return {
    async upsertNode(node){nodes.set(node.id,structuredClone(node));},
    async upsertEdge(edge){edges.set(edge.id,structuredClone(edge));},
    snapshot(){return {nodes:[...nodes.values()],edges:[...edges.values()]}}
  };
}
export function createMemoryVectorWriter(){
  const points=new Map();
  return {async upsert(point){points.set(point.id,structuredClone(point));},snapshot(){return [...points.values()]}};
}
