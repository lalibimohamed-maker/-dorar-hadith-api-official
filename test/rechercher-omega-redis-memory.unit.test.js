import test from "node:test";
import assert from "node:assert/strict";
import { createRedisConversationMemory } from "../src/rechercher-omega-redis-memory.js";
test("Redis memory config exposes a dedicated operational store",()=>{
 const m=createRedisConversationMemory({host:"127.0.0.1",port:6379,keyPrefix:"x:"});
 assert.equal(m.enabled,true);
});
