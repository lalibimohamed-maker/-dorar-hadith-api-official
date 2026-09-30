import test from "node:test";
import assert from "node:assert/strict";
import { createRedisConversationMemory } from "../src/rechercher-omega-redis-memory.js";

test("Redis conversation memory stores digests only and retrieves session turns",async()=>{
 const keyPrefix="test:dinullah:"+Date.now()+":";
 const memory=createRedisConversationMemory({host:"127.0.0.1",port:6379,keyPrefix});
 const a=await memory.appendDigest({sessionId:"s1",role:"user",content:"سر يجب ألا يخزن خاما"});
 const b=await memory.appendDigest({sessionId:"s1",role:"assistant",content:"رد موثق"});
 assert.match(a.content_sha256,/^[0-9a-f]{64}$/); assert.match(b.content_sha256,/^[0-9a-f]{64}$/);
 const rows=await memory.snapshotDigests({sessionId:"s1"});
 assert.equal(rows.length,2);
 const parsed=rows.map(JSON.parse);
 assert.equal(parsed[0].content,"undefined" in parsed[0] ? parsed[0].content : undefined);
 assert.ok(parsed[0].content_sha256); assert.equal("raw" in parsed[0],false);
 await memory.clear({sessionId:"s1"});
 assert.deepEqual(await memory.snapshotDigests({sessionId:"s1"}),[]);
});
