import test from "node:test";
import assert from "node:assert/strict";
import { createRedisConversationMemory } from "../src/rechercher-omega-redis-memory.js";

test("Redis conversation memory stores digests only and retrieves session turns",async()=>{
 const keyPrefix="test:dinullah:"+Date.now()+":";
 const memory=createRedisConversationMemory({host:"127.0.0.1",port:6379,keyPrefix});
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
