import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { createRedisConversationMemory } from "../src/rechercher-omega-redis-memory.js";

async function redisAvailable(host,port){
 return new Promise(resolve=>{
  const socket=net.createConnection({host,port});
  const done=value=>{socket.destroy();resolve(value);};
  socket.once("connect",()=>done(true));
  socket.once("error",()=>done(false));
  socket.setTimeout(1000,()=>done(false));
 });
}

test("Redis conversation memory stores digests only and retrieves session turns",async(t)=>{
 const host=process.env.REDIS_HOST||"127.0.0.1";
 const port=Number(process.env.REDIS_PORT||6379);
 if(!(await redisAvailable(host,port))){
  t.skip("Redis service is not configured in this CI job; integration is exercised by the dedicated GraphRAG/Memory workflow.");
  return;
 }
 const keyPrefix="test:dinullah:"+Date.now()+":";
 const memory=createRedisConversationMemory({host,port,keyPrefix});
 const original1="سر يجب ألا يخزن خاما";
 const original2="رد موثق";
 await memory.appendDigest({sessionId:"s1",role:"user",content:original1});
 await memory.appendDigest({sessionId:"s1",role:"assistant",content:original2});
 const rows=await memory.snapshotDigests({sessionId:"s1"});
 assert.equal(rows.length,2);
 const parsed=rows.map(JSON.parse);
 assert.equal(parsed[0].role,"user");
 assert.equal(parsed[0].content_sha256.length,64);
 assert.equal("content" in parsed[0],false);
 assert.notEqual(parsed[0].content_sha256,original1);
 await memory.clear({sessionId:"s1"});
 assert.deepEqual(await memory.snapshotDigests({sessionId:"s1"}),[]);
});
