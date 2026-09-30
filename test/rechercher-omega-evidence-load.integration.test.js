import test from "node:test";
import assert from "node:assert/strict";

const evidence=[{sourceId:"bukhari",citation:"vol.1 p.1",kind:"primary_text",exact_quote_required:true,text:"إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ"}];
const citations=[{sourceId:"bukhari",citation:"vol.1 p.1"}];
const validBody=()=>({answer:"إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ",evidence,citations});

test("AI gateway survives concurrent strict-verification load",async()=>{
 const {createAiGateway}=await import("../src/rechercher-ai-gateway.js");
 const server=createAiGateway({host:"127.0.0.1",port:0}); const port=server.address().port;
 try{
  const results=await Promise.all(Array.from({length:100},()=>fetch("http://127.0.0.1:"+port+"/api/v1/agents/verify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(validBody())})));
  assert.equal(results.length,100);
  assert.equal((await Promise.all(results.map(r=>r.status))).filter(s=>s===200).length,100);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test("MCP survives concurrent strict-verification load",async()=>{
 const {createMcpServer}=await import("../src/rechercher-ai-mcp-server.js");
 const server=createMcpServer({host:"127.0.0.1",port:0}); const port=server.address().port;
 try{
  const results=await Promise.all(Array.from({length:100},(_,i)=>fetch("http://127.0.0.1:"+port+"/mcp",{method:"POST",headers:{"content-type":"application/json","mcp-protocol-version":"2026-07-28"},body:JSON.stringify({jsonrpc:"2.0",id:i+1,method:"tools/call",params:{name:"deen_verify_answer",arguments:{answer:validBody().answer,evidence_json:JSON.stringify(evidence),citations_json:JSON.stringify(citations)}}})})));
  assert.equal(results.length,100);
  const payloads=await Promise.all(results.map(r=>r.json()));
  assert.equal(payloads.filter(x=>x.result?.structuredContent?.verified===true).length,100);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
