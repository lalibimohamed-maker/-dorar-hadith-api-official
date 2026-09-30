import test from "node:test";
import assert from "node:assert/strict";
import {indexCorpusToGraphRag,createMemoryGraphWriter,createMemoryVectorWriter} from "../src/rechercher-omega-graphrag-runtime.js";
test("GraphRAG indexes every Corpus record into graph and vector layers",async()=>{
 const graph=createMemoryGraphWriter(), vector=createMemoryVectorWriter();
 const records=[
  {node_id:"q1",category:"quran_verse",text_raw:"الحمد لله رب العالمين",provenance:{sourceId:"quran",citation:"1:2"},links:[{to:"taf1",type:"explains",provenance:{sourceId:"t1",citation:"v1 p1"}}]},
  {node_id:"h1",category:"hadith",text_raw:"إنما الأعمال بالنيات",provenance:{sourceId:"bukhari",citation:"v1 p1"}}
 ];
 const r=await indexCorpusToGraphRag(records,{graphWriter:graph,vectorWriter:vector,embedder:{embed:async()=>[.1,.2,.3]}});
 assert.equal(r.indexedRecords,2);assert.equal(graph.snapshot().nodes.length,2);assert.equal(graph.snapshot().edges.length,1);assert.equal(vector.snapshot().length,2);assert.equal(r.corpusWrite,false);
});
test("GraphRAG rejects unprovenanced Corpus records",async()=>{
 await assert.rejects(()=>indexCorpusToGraphRag([{text_raw:"x"}],{graphWriter:createMemoryGraphWriter(),vectorWriter:createMemoryVectorWriter(),embedder:{embed:async()=>[1]}}),/source provenance/);
});
