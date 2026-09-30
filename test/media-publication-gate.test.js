import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePublicationReadiness, assertPublicationReady } from "../src/media/media-publication-gate.mjs";

test("public media blocks when any required gate is pending",()=>{
 const r=evaluatePublicationReadiness({rights:"passed",provenance:"passed",quality:"passed",safety:"pending",accessibility:"passed"});
 assert.equal(r.status,"blocked"); assert.equal(r.public_promotion_allowed,false); assert.ok(r.failed.includes("safety"));
});

test("public media becomes ready only when every gate passes",()=>{
 const r=evaluatePublicationReadiness({rights:"passed",provenance:"passed",quality:"passed",safety:"passed",accessibility:"passed"});
 assert.equal(r.status,"ready"); assert.doesNotThrow(()=>assertPublicationReady(r));
});

test("non-public research output does not require public promotion",()=>{
 const r=evaluatePublicationReadiness({publicRequested:false});
 assert.equal(r.status,"not_requested"); assert.deepEqual(r.failed,[]);
});
