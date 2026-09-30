import test from "node:test";
import assert from "node:assert/strict";
import { createRedisSessionStore } from "../src/rechercher-omega-redis-session-store.js";

test("Redis session adapter persists only session data and uses TTL",async()=>{
 const db=new Map(),calls=[];
 const client={command:async(...args)=>{calls.push(args);if(args[0]==="GET")return db.get(args[1])??null;if(args[0]==="SET"){db.set(args[1],args[2]);return "OK";}if(args[0]==="DEL"){db.delete(args[1]);return 1;}throw new Error("unexpected");}};
 const store=createRedisSessionStore({client,prefix:"test:",ttlSeconds:3600});
 assert.equal(await store.set("s1",{turns:3,contextHash:"abc"}),true);
 assert.deepEqual(await store.get("s1"),{turns:3,contextHash:"abc"});
 assert.deepEqual(calls[0],["SET","test:s1",JSON.stringify({turns:3,contextHash:"abc"}),"EX",3600]);
 await store.delete("s1"); assert.equal(await store.get("s1"),null);
});
