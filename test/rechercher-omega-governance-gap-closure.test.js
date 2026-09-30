import test from "node:test"; import assert from "node:assert/strict";
import {normalizeResearchQuery} from "../src/rechercher-omega-query-normalizer.js";
import {verifyEvidenceGate} from "../src/rechercher-omega-evidence-gate.js";
import {resolveEvidenceConflicts} from "../src/rechercher-omega-conflict-resolution.js";
test("query normalization",()=>{const a=normalizeResearchQuery(" إِنَّ اللهَ، غفورٌ؟ ");assert.equal(a.normalized,"ان الله غفور");assert.equal(a.language,"ar");});
test("strict evidence gate",()=>{assert.throws(()=>verifyEvidenceGate({answer:"x"}),/NO_EVIDENCE_FOUND/);const e={sourceId:"book-1",citation:"vol.1 p.2",text:"نص"};assert.equal(verifyEvidenceGate({answer:"x",evidence:[e],citations:[{sourceId:e.sourceId,citation:e.citation}]}).ok,true);});
test("conflicts preserved",()=>{const r=resolveEvidenceConflicts([{topic:"issue",value:"A"},{topic:"issue",value:"B"}]);assert.equal(r[0].status,"conflict");assert.equal(r[0].resolution,"preserve_all_sources");});
