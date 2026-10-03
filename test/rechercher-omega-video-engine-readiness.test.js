import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateVideoEngineReadiness,
  assertVideoEngineExecutionReady,
  localVideoExecutionContract
} from "../src/rechercher-omega-video-engine-readiness.js";

test("review-only storage is visible but never execution-ready",()=>{
  const result=evaluateVideoEngineReadiness({
    engineId:"hunyuanvideo-1.5",
    localUseCleared:false,
    publicDistributionCleared:false,
    weightsPresent:true,
    distributionTarget:"private"
  });
  assert.equal(result.status,"stored_private_review");
  assert.equal(result.execution_allowed,false);
  assert.equal(result.quota_required,false);
});

test("execution requires runtime, dependencies, immutable revision, SHA-256 and e2e proof",()=>{
  const blocked=evaluateVideoEngineReadiness({
    engineId:"ltx-2",
    localUseCleared:true,
    publicDistributionCleared:false,
    weightsPresent:true,
    revisionVerified:true,
    sha256Verified:true,
    runtimePresent:true,
    dependenciesVerified:false,
    e2eSmokeTestPassed:false
  });
  assert.equal(blocked.status,"dependency_blocked");
  const ready=evaluateVideoEngineReadiness({
    engineId:"ltx-2",
    localUseCleared:true,
    publicDistributionCleared:false,
    weightsPresent:true,
    revisionVerified:true,
    sha256Verified:true,
    runtimePresent:true,
    dependenciesVerified:true,
    e2eSmokeTestPassed:true
  });
  assert.equal(ready.status,"ready");
  assert.doesNotThrow(()=>assertVideoEngineExecutionReady(ready));
});

test("local video generation has no per-video API token quota",()=>{
  const contract=localVideoExecutionContract({
    engineId:"hunyuanvideo-1.5",
    modelRevision:"9b49404b3f5df2a8f0b31df27a0c7ab872e7b038",
    storageRepository:"lalibimohamed-maker/rechercher-omega-engine-storage",
    storageReleaseTag:"rechercher-omega-hunyuanvideo15-v1.0.0",
    runtime:"kaggle-gpu"
  });
  assert.equal(contract.quota.required,false);
  assert.equal(contract.quota.semantics,"not_applicable_to_local_weight_execution");
  assert.equal(contract.corpus_write_allowed,false);
});

test("public redistribution clearance is not required for private local execution once local-use is cleared",()=>{
  const result=evaluateVideoEngineReadiness({
    engineId:"ltx-2",
    localUseCleared:true,
    publicDistributionCleared:false,
    weightsPresent:true,
    revisionVerified:true,
    sha256Verified:true,
    runtimePresent:true,
    dependenciesVerified:true,
    e2eSmokeTestPassed:true,
    distributionTarget:"private"
  });
  assert.equal(result.status,"ready");
  assert.equal(result.execution_allowed,true);
  assert.equal(result.public_distribution_allowed,false);
});
