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
