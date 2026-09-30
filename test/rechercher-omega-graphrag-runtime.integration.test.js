import test from "node:test";
import assert from "node:assert/strict";
import { indexCorpusToGraphRag, createMemoryGraphWriter, createMemoryVectorWriter } from "../src/rechercher-omega-graphrag-runtime.js";

const records=[
 {node_id:"q:1",category:"quran_verse",text_raw:"إِنَّ اللَّهَ غَفُورٌ رَحِيمٌ",provenance:{sourceId:"quran",citation:"39:53",sourceUrl:"quran://canonical"}},
 {node_id:"h:1",category:"hadith",text_raw:"إنما الأعمال بالنيات",provenance:{sourceId:"bukhari",citation:"Sahih al-Bukhari 1",sourceUrl:"bukhari://1"},links:[{to:"q:1",type:"related_to",provenance:{sourceId:"bukhari",citation:"1"}}]}
];

test("Corpus records are indexed into graph and vector stores with provenance",async()=>{
 const graphWriter=createMemoryGraphWriter(),vectorWriter=createMemoryVectorWriter();
 const result=await indexCorpusToGraphRag(records,{
  embedder:{embed:async text=>String(text).includes("الأعمال")?[1,0]:[0,1]},
  graphWriter,vectorWriter,batchSize:1,strict:true
 });
 assert.equal(result.indexedRecords,2); assert.equal(result.graphNodes,2); assert.equal(result.vectorPoints,2); assert.equal(result.corpusWrite,false);
 assert.equal(graphWriter.snapshot().edges.length,1); assert.equal(vectorWriter.snapshot().length,2);
 assert.equal(graphWriter.snapshot().nodes[0].text_hash.length,64);
});

test("Indexing is fail-closed when an embedding worker returns no vector",async()=>{
 await assert.rejects(()=>indexCorpusToGraphRag(records,{
  embedder:{embed:async()=>[]},graphWriter:createMemoryGraphWriter(),vectorWriter:createMemoryVectorWriter()
 }),/EMPTY_EMBEDDING/);
});
