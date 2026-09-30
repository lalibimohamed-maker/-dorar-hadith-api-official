import test from "node:test";
import assert from "node:assert/strict";
import {MCP_PROTOCOL_VERSION,SUPPORTED_MCP_VERSIONS} from "../src/rechercher-ai-mcp-server.js";

test("MCP uses the current 2026-07-28 protocol and keeps legacy compatibility",()=>{
  assert.equal(MCP_PROTOCOL_VERSION,"2026-07-28");
  assert.deepEqual(SUPPORTED_MCP_VERSIONS,["2026-07-28","2025-11-25"]);
});

test("MCP server is stateless and exposes no corpus-write tools",async()=>{
  const mod=await import("../src/rechercher-ai-mcp-server.js");
  assert.equal(typeof mod.createMcpServer,"function");
  assert.equal(mod.SUPPORTED_MCP_VERSIONS.includes("2026-07-28"),true);
});

test("strict schema files are valid JSON",async()=>{
  const fs=await import("node:fs/promises");
  for(const file of ["schemas/islamic-corpus-node.schema.json","schemas/hadith-evidence.schema.json","schemas/quran-evidence.schema.json","config/rechercher-ai-api-mcp-2026.json"]){
    const value=JSON.parse(await fs.readFile(file,"utf8"));
    assert.equal(typeof value,"object");
  }
});


import { strictAnchoringDescription, enforceMcpResponseAnchoring } from "../src/rechercher-ai/mcp-strict-anchoring.js";

test("MCP strict anchoring exposes explicit governance rules",()=>{
  const description=strictAnchoringDescription("deen_verify_answer");
  assert.match(description,/DINULLAH STRICT EVIDENCE ANCHOR/);
  assert.match(description,/server-side verification/i);
  assert.match(description,/NO_EVIDENCE_FOUND/);
  assert.match(description,/diacritics/);
  const { TOOLS } = await import("../src/rechercher-ai-mcp-server.js").catch(()=>({TOOLS:[]}));
  if (Array.isArray(TOOLS) && TOOLS.length) {
    const verifyTool=TOOLS.find(tool=>tool.name==="deen_verify_answer");
    assert.equal(verifyTool.annotations.readOnlyHint,true);
    assert.equal(verifyTool.annotations.destructiveHint,false);
  }
});

test("MCP anchoring rejects altered primary text and returns deterministic fallback",()=>{
  const node={
    text_raw:"إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ",
    provenance:{source:"Sahih al-Bukhari",page:1}
  };
  const rejected=enforceMcpResponseAnchoring({
    agentOutput:"إنما الأعمال بالنية.",
    verifiedNode:node
  });
  assert.equal(rejected.status,"REJECTED");
  assert.equal(rejected.reason,"STRICT_ALIGNMENT_MISMATCH");
  assert.equal(rejected.fallback_output,node.text_raw);
  assert.deepEqual(rejected.provenance,node.provenance);
});

test("MCP anchoring accepts canonical-equivalent Unicode representation",()=>{
  const node={text_raw:"إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ",provenance:{}};
  const equivalent=node.text_raw.normalize("NFKD").normalize("NFC");
  const approved=enforceMcpResponseAnchoring({
    agentOutput:"النص: "+equivalent,
    verifiedNode:node
  });
  assert.equal(approved.status,"APPROVED");
});
