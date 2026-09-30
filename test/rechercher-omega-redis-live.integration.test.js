import test from "node:test";
import assert from "node:assert/strict";
import { createRedisConversationMemory } from "../src/rechercher-omega-redis-memory.js";

test("Redis adapter performs a real digest-only session round trip",async()=>{
 const store=createRedisConversationMemory({host:process.env.REDIS_HOST||"127.0.0.1",port:Number(process.env.REDIS_PORT||6379),keyPrefix:"ci:deen:live:"});
 await store.clear({sessionId:"smoke"});
 const item=await store.appendDigest({sessionId:"smoke",role:"user",content:"اختبار ذاكرة حي"});
 const rows=await store.snapshotDigests({sessionId:"smoke"});
 assert.equal(rows.length,1);
 assert.match(rows[0],new RegExp(item.content_sha256));
 assert.doesNotMatch(rows[0],/اختبار ذاكرة حي/);
 await store.clear({sessionId:"smoke"});
 assert.deepEqual(await store.snapshotDigests({sessionId:"smoke"}),[]);
});
