import test from "node:test";
import assert from "node:assert/strict";
import {createRedisConversationStore} from "../src/rechercher-omega-redis-memory.js";
test("Redis store exposes bounded key-value conversation persistence contract",()=>{
 const s=createRedisConversationStore({host:"127.0.0.1",port:6379,prefix:"test:deen:"});
 assert.equal(typeof s.set,"function"); assert.equal(typeof s.get,"function"); assert.equal(typeof s.delete,"function");
});
