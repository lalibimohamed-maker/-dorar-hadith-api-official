import test from "node:test";
import assert from "node:assert/strict";
import { createQdrantVectorWriter } from "../src/rechercher-omega-qdrant.js";

test("Qdrant adapter supports provenance-bearing upsert and current query retrieval",async()=>{
 const calls=[];
 const fetchImpl=async(url,init={})=>{
  calls.push({url,init});
  return {ok:true,status:200,async json(){return {result:{points:[{id:"p1",score:0.9,payload:{sourceId:"s1",text_hash:"x"}}]}}}};
 };
 const q=createQdrantVectorWriter({url:"http://127.0.0.1:6333",collection:"dinullah_test",apiKey:"k",fetchImpl});
 await q.upsert({id:"p1",vector:[0.1,0.2],payload:{sourceId:"s1"}});
 const rows=await q.search({vector:[0.1,0.2],limit:5});
 assert.equal(rows.length,1); assert.equal(rows[0].payload.sourceId,"s1");
 assert.match(calls[1].url,/\/points\/query$/);
 const body=JSON.parse(calls[1].init.body);
 assert.deepEqual(body.query,[0.1,0.2]); assert.equal(body.with_payload,true); assert.equal(body.limit,5);
});

test("Qdrant adapter fails closed without configuration",async()=>{
 const q=createQdrantVectorWriter({url:""});
 assert.equal(q.enabled,false);
 await assert.rejects(()=>q.search({vector:[1]}),/QDRANT_NOT_CONFIGURED/);
});
