import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
test("Omega runtime gates distinguish transport chunks from model shards",async()=>{
 const p=new URL("../config/rechercher-omega-engine-runtime-gates-2026.json",import.meta.url);
 const x=JSON.parse(await fs.readFile(p,"utf8"));
 assert.equal(x.policy.runtimeEnabledOnlyAfterAllGates,true);
 assert.match(x.activationRule,/active only when every required gate is true/);
 assert.equal(x.engines["llama.cpp"].includes("model-smoke-required"),true);
});
