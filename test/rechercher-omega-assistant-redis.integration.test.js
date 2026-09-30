import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { runGovernedAssistantTurn } from "../src/rechercher-omega-assistant-bridge.js";
import { sha256 } from "../src/rechercher-omega-redis-memory.js";

const evidence=[{
  source_id:"bukhari-1",
  citation:"sahih-bukhari|1|page-1",
  kind:"primary_text",
  exact_quote_required:true,
  text:"إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ",
  text_hash:sha256("إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ")
}];

const citations=[{
  sourceId:"bukhari-1",
  citation:"sahih-bukhari|1|page-1",
  text_hash:sha256(evidence[0].text)
}];

const registry={
  models:[{
    id:"qwen3",
    source:"fixture",
    status:"candidate",
    license_review:"verified",
    license_status:"verified_source_license",
    runtime_enabled:true
  }]
};

const backends={
  backends:[{
    id:"local",
    kind:"local",
    free:true,
    requires_gpu:false,
    weights_required:true,
    priority:1
  }]
};

function runtimeArtifact(){
  return {
    state:"ready",
    sha256_verified:true,
    revision_verified:true,
    license_verified:true
  };
}

function storeFixture({ping=true, appendFailure=false}={}){
  const rows=[];
  return {
    rows,
    async ping(){ if(!ping) throw new Error("redis unavailable"); return true; },
    async appendDigest(record){
      if(appendFailure) throw new Error("redis append unavailable");
      const {content,...metadata}=record;
      const stored={
        ...metadata,
        content_sha256:sha256(content),
        chars:content.length
      };
      delete stored.content;
      rows.push(stored);
      return stored;
    }
  };
}

function claimRecord(statement){
  const normalized=statement.normalize("NFKC").normalize("NFC").replace(/\s+/gu," ").trim();
  return {
    claim_text:normalized,
    claim_sha256:createHash("sha256").update(normalized,"utf8").digest("hex"),
    verification_status:"verified",
    support_type:"knowledge_graph",
    support_id:"kg:fixture:bridge",
    citations
  };
}

test("governed assistant persists only digest metadata on green path",async()=>{
  const store=storeFixture();
  const result=await runGovernedAssistantTurn({
    query:"ما نص الحديث الأول؟",
    evidence,
    language:"ar",
    output_kind:"analysis",
    availableBackends:["local"],
    backendHealth:{local:{status:"healthy"}},
    execute:true,
    registry,
    backends,
    runtimeArtifact:runtimeArtifact(),
    sessionId:"session-green",
    distributedMemory:store,
    requireDistributedMemory:true,
    executor:async()=>({provider:"fixture",model:"qwen3",text:evidence[0].text,output_sha256:sha256(evidence[0].text)})
  });

  assert.equal(result.status,"succeeded");
  assert.equal(result.distributed_memory.state,"persisted");
  assert.equal(store.rows.length,2);
  assert.deepEqual(store.rows.map(row=>row.role),["user","assistant"]);
  assert.equal(store.rows[1].verified,true);
  assert.equal(store.rows[1].outputSha256,sha256(evidence[0].text));
  assert.equal("content" in store.rows[0],false);
  assert.equal("content" in store.rows[1],false);
});

test("governed assistant blocks a scholarly inference unless trusted claim provenance is supplied",async()=>{
  const store=storeFixture();
  const statement="وهذا الحديث يدل على وجوب النية في العمل";

  const blocked=await runGovernedAssistantTurn({
    query:"حديث الأعمال بالنيات",
    evidence,
    availableBackends:["local"],
    backendHealth:{local:{status:"healthy"}},
    execute:true,
    registry,
    backends,
    runtimeArtifact:runtimeArtifact(),
    executor:async()=>({provider:"fixture",model:"qwen3",text:evidence[0].text+". "+statement+"."})
  });
  assert.equal(blocked.status,"blocked");
  assert.equal(blocked.verification.error.code,"UNSUPPORTED_CLAIM");
  assert.equal(blocked.fallback,evidence[0].text);

  const allowed=await runGovernedAssistantTurn({
    query:"حديث الأعمال بالنيات",
    evidence,
    availableBackends:["local"],
    backendHealth:{local:{status:"healthy"}},
    execute:true,
    registry,
    backends,
    runtimeArtifact:runtimeArtifact(),
    claimProvenance:[claimRecord(statement)],
    executor:async()=>({provider:"fixture",model:"qwen3",text:evidence[0].text+". "+statement+"."})
  });
  assert.equal(allowed.status,"succeeded");
  assert.equal(allowed.verification.claimVerification.ok,true);
});

test("governed assistant records hallucination attempt as unverified digest and returns corpus fallback",async()=>{
  const store=storeFixture();
  const result=await runGovernedAssistantTurn({
    query:"حديث الأعمال بالنيات",
    evidence,
    availableBackends:["local"],
    backendHealth:{local:{status:"healthy"}},
    execute:true,
    registry,
    backends,
    runtimeArtifact:runtimeArtifact(),
    sessionId:"session-red",
    distributedMemory:store,
    requireDistributedMemory:true,
    executor:async()=>({provider:"fixture",model:"qwen3",text:"إنما الأعمال بالنية."})
  });

  assert.equal(result.status,"blocked");
  assert.equal(result.verification.error.code,"STRICT_ALIGNMENT_MISMATCH");
  assert.equal(result.fallback,evidence[0].text);
  assert.equal(store.rows.length,2);
  assert.equal(store.rows[1].verified,false);
  assert.equal(store.rows[1].outputSha256,sha256("إنما الأعمال بالنية."));
  assert.equal(store.rows.some(row=>JSON.stringify(row).includes("إنما الأعمال بالنية.")),false);
});

test("mandatory distributed memory fails closed before model execution when Redis is unavailable",async()=>{
  const store=storeFixture({ping:false});
  let executorCalls=0;
  const result=await runGovernedAssistantTurn({
    query:"سؤال يحتاج جلسة موزعة",
    evidence,
    availableBackends:["local"],
    backendHealth:{local:{status:"healthy"}},
    execute:true,
    registry,
    backends,
    runtimeArtifact:runtimeArtifact(),
    sessionId:"session-required-redis",
    distributedMemory:store,
    requireDistributedMemory:true,
    executor:async()=>{
      executorCalls+=1;
      return {text:evidence[0].text};
    }
  });

  assert.equal(result.status,"blocked");
  assert.equal(result.error.code,"REDIS_MEMORY_UNAVAILABLE");
  assert.equal(executorCalls,0);
});

test("optional distributed memory can degrade to bounded volatile execution without claiming persistence",async()=>{
  const store=storeFixture({ping:false});
  const result=await runGovernedAssistantTurn({
    query:"سؤال اختياري الذاكرة الموزعة",
    evidence,
    availableBackends:["local"],
    backendHealth:{local:{status:"healthy"}},
    execute:true,
    registry,
    backends,
    runtimeArtifact:runtimeArtifact(),
    sessionId:"session-optional-redis",
    distributedMemory:store,
    requireDistributedMemory:false,
    executor:async()=>({provider:"fixture",model:"qwen3",text:evidence[0].text})
  });

  assert.equal(result.status,"succeeded");
  assert.equal(result.distributed_memory.state,"unavailable");
});
