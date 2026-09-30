import test from "node:test";
import assert from "node:assert/strict";
import { createCorpusGraphRagPipeline } from "../src/rechercher-omega-corpus-graphrag.js";
import { createMemoryGraphWriter, createMemoryVectorWriter } from "../src/rechercher-omega-graphrag-runtime.js";

test("Corpus GraphRAG pipeline wires the loader to both graph and vector stores",async()=>{
 const records=[
  {node_id:"q1",category:"quran_verse",text_raw:"الحمد لله",provenance:{sourceId:"quran",citation:"1:2"},verification_state:"verified"},
  {node_id:"h1",category:"hadith",text_raw:"إنما الأعمال بالنيات",provenance:{sourceId:"bukhari",citation:"v1 p1"},verification_state:"source_verified"}
 ];
 const graph=createMemoryGraphWriter(), vector=createMemoryVectorWriter();
 const p=createCorpusGraphRagPipeline({
   corpusLoader:()=>records,
   embedder:{embed:async(text)=>[text.length,1]},
   graphWriter:graph,vectorWriter:vector
 });
 const r=await p.indexAll();
 assert.equal(r.source,"loadCorpus");
 assert.equal(r.corpusRecordsLoaded,2);
 assert.equal(r.indexedRecords,2);
 assert.equal(r.fullCorpusCoverageVerified,true);
 assert.equal(graph.snapshot().nodes.length,2);
 assert.equal(vector.snapshot().length,2);
});

test("Full Corpus production pipeline rejects a missing persistent writer instead of silently falling back",async()=>{
 const p=createCorpusGraphRagPipeline({
   corpusLoader:()=>[{node_id:"x",category:"hadith",text_raw:"x",provenance:{sourceId:"s",citation:"p1"},verification_state:"verified"}],
   embedder:{embed:async()=>[1]},
   graphWriter:null,
   vectorWriter:null
 });
 await assert.rejects(()=>p.indexAll(),/graphWriter is incomplete/);
});
