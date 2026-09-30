import test from "node:test";
import assert from "node:assert/strict";

test("AI gateway exports a dependency-free server factory",async()=>{
  const mod=await import("../src/rechercher-ai-gateway.js");
  assert.equal(typeof mod.createAiGateway,"function");
});

test("AI gateway contract remains read-only",async()=>{
  const fs=await import("node:fs/promises");
  const source=await fs.readFile("src/rechercher-ai-gateway.js","utf8");
  assert.equal(source.includes("POST"),true);
  assert.equal(source.includes("/agents/search"),true);
  assert.equal(source.includes("Corpus"),false);
  assert.equal(source.includes("RATE_LIMIT_EXCEEDED"),true);
});
