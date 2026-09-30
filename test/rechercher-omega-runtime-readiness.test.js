import test from "node:test";
import assert from "node:assert/strict";
import { evaluateRuntimeArtifactReadiness, assertRuntimeArtifactReady } from "../src/rechercher-omega-runtime-readiness.js";

test("weights-required backend blocks unknown runtime artifact state",()=>{
 const r=evaluateRuntimeArtifactReadiness();
 assert.equal(r.status,"blocked");
});

test("runtime artifact requires all three verifications",()=>{
 const r=evaluateRuntimeArtifactReadiness({artifactState:"verified_installed",revisionVerified:true,licenseVerified:true,sha256Verified:false});
 assert.equal(r.status,"blocked");
});

test("fully verified installed artifact is execution-ready",()=>{
 const r=evaluateRuntimeArtifactReadiness({artifactState:"verified_installed",revisionVerified:true,licenseVerified:true,sha256Verified:true});
 assert.equal(r.status,"ready");
 assert.doesNotThrow(()=>assertRuntimeArtifactReady(r));
});
