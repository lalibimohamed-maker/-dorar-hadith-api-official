import test from "node:test";
import assert from "node:assert/strict";
import { createRedisConversationMemory } from "../src/rechercher-omega-redis-memory.js";

test("Redis store exposes a bounded digest-only conversation contract",()=>{
 const s=createRedisConversationMemory({host:"127.0.0.1",port:6379,keyPrefix:"test:deen:"});
 assert.equal(typeof s.appendDigest,"function");
 assert.equal(typeof s.snapshotDigests,"function");
 assert.equal(typeof s.clear,"function");
});
