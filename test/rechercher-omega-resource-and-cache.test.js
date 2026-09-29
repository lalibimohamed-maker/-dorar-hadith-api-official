import test from "node:test";
import assert from "node:assert/strict";
import { admitExecution } from "../src/rechercher-omega-resource-admission.js";
import { buildSemanticCacheKey, createCacheEntry, isCacheReusable, MemorySemanticCache } from "../src/rechercher-omega-semantic-cache.js";

test("resource admission queues when concurrency is saturated", () => {
  const result = admitExecution({ pool:{max_concurrency:1}, currentJobs:1 });
  assert.equal(result.status,"queued");
  assert.equal(result.reason,"concurrency_limit");
});

test("resource admission queues when VRAM budget would be exceeded", () => {
  const result = admitExecution({ pool:{max_concurrency:2,vram_budget_mb:16000}, currentJobs:0,currentVramMb:12000,requiredVramMb:5000 });
  assert.equal(result.status,"queued");
  assert.equal(result.reason,"vram_budget");
});

test("resource admission admits a job under both limits", () => {
  const result = admitExecution({ pool:{max_concurrency:2,vram_budget_mb:16000}, currentJobs:1,currentVramMb:4000,requiredVramMb:6000 });
  assert.equal(result.status,"admitted");
});

test("semantic cache invalidates on evidence/model revision changes", () => {
  const a=buildSemanticCacheKey({task:"scholarly_answer",model:"qwen3",modelRevision:"1",prompt:"x",evidence:[{source_id:"s1",text:"e"}]});
  const b=buildSemanticCacheKey({task:"scholarly_answer",model:"qwen3",modelRevision:"2",prompt:"x",evidence:[{source_id:"s1",text:"e"}]});
  const c=buildSemanticCacheKey({task:"scholarly_answer",model:"qwen3",modelRevision:"1",prompt:"x",evidence:[{source_id:"s1",text:"e2"}]});
  assert.notEqual(a,b); assert.notEqual(a,c);
});

test("semantic cache stores references without raw conversation content", () => {
  const key=buildSemanticCacheKey({task:"text_to_speech",model:"kokoro",prompt:"secret text"});
  const entry=createCacheEntry({key,outputRef:"artifact://voice/1",ttlMs:1000});
  assert.equal(entry.privacy.raw_prompt_stored,false);
  assert.equal(isCacheReusable(entry,key),true);
});

test("memory cache evicts oldest entry when bounded", () => {
  const cache=new MemorySemanticCache({maxEntries:2});
  cache.set(createCacheEntry({key:"a"})); cache.set(createCacheEntry({key:"b"})); cache.set(createCacheEntry({key:"c"}));
  assert.equal(cache.get("a"),null); assert.ok(cache.get("b")); assert.ok(cache.get("c"));
});
