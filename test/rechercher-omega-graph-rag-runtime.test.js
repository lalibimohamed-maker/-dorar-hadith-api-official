import test from "node:test";
import assert from "node:assert/strict";
import { createGraphRagRuntime, createInMemoryVectorStore } from "../src/rechercher-omega-graph-rag-runtime.js";

test("GraphRAG ingests an arbitrary Corpus stream into graph and vector layers",async()=>{
 const runtime=createGraphRagRuntime({vectorStore:createInMemoryVectorStore(),batchSize:2});
 const rows=Array.from({length:5},(_,i)=>({id:"d"+i,type:"book",text:"نص علمي "+i,sourceId:"s"+i,citation:"p."+i,verificationState:"source_verified",provenance:{sourceId:"s"+i,citation:"p."+i}}));
 async function* stream(){for(const row of rows)yield row;}
 const result=await runtime.ingestIterable(stream());
 assert.equal(result.ingested,5); assert.equal(result.graphNodes,5); assert.equal(runtime.snapshot().nodes.length,5);
 const hits=await runtime.search("نص", {limit:3});
 assert.equal(hits.length,3); assert.ok(hits[0].graphNode);
});

test("GraphRAG rejects unprovenanced source rows",async()=>{
 const runtime=createGraphRagRuntime({vectorStore:createInMemoryVectorStore()});
 await assert.rejects(()=>runtime.ingestRecords([{text:"x"}]),/requires sourceId and citation/);
});

test("GraphRAG keeps Corpus writes out of the runtime boundary",async()=>{
 const runtime=createGraphRagRuntime({vectorStore:createInMemoryVectorStore()});
 await runtime.ingestRecords([{id:"x",type:"book",text:"نص",sourceId:"s",citation:"p.1",provenance:{sourceId:"s",citation:"p.1"}}]);
 assert.deepEqual(runtime.snapshot().nodes[0].provenance,{sourceId:"s",citation:"p.1"});
});
