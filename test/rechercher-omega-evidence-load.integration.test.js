import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

process.env.AI_GATEWAY_RATE_PER_MINUTE="10000";
process.env.AI_GATEWAY_BURST="1000";
process.env.MCP_RATE_LIMIT_PER_MINUTE="10000";
process.env.MCP_RATE_BURST="1000";

async function start(server){
 await once(server,"listening");
 return server.address().port;
}
async function stop(server){
 server.closeAllConnections?.();
 if(server.listening) await new Promise(resolve=>server.close(resolve));
}

const evidence=[{
 sourceId:"bukhari",evidence_id:"h:1",citation:"vol.1 p.1",kind:"primary_text",type:"hadith",
 exact_quote_required:true,text:"إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ",sha256:"b0282fe41fa1cd9e3224fcf46fbd7180eb6c954396bfcb7b92a858e0220c9c28",
 source:"sahih-bukhari",document_id:"bukhari:1",rights_status:"cleared",provenance:"verified",
 verification_status:"verified",authenticity_status:"sahih"
}];
const citations=[{sourceId:"bukhari",citation:"vol.1 p.1",text_hash:"b0282fe41fa1cd9e3224fcf46fbd7180eb6c954396bfcb7b92a858e0220c9c28"}];
const validBody=()=>({answer:"إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ",evidence,citations});

test("AI gateway survives concurrent strict-verification load",async()=>{
 const {createAiGateway}=await import("../src/rechercher-ai-gateway.js?evidence-load-ai");
 const server=createAiGateway({host:"127.0.0.1",port:0});
 try{
  const port=await start(server);
  const results=await Promise.all(Array.from({length:40},()=>fetch("http://127.0.0.1:"+port+"/api/v1/agents/verify",{method:"POST",headers:{"content-type":"application/json","connection":"close"},body:JSON.stringify(validBody()),signal:AbortSignal.timeout(5000)})));
  assert.equal(results.length,40);
  assert.equal((await Promise.all(results.map(r=>r.status))).filter(s=>s===200).length,40);
 }finally{await stop(server);}
});

test("MCP survives concurrent strict-verification load",async()=>{
 const {createMcpServer}=await import("../src/rechercher-ai-mcp-server.js?evidence-load-mcp");
 const server=createMcpServer({host:"127.0.0.1",port:0});
 try{
  const port=await start(server);
  const results=await Promise.all(Array.from({length:40},(_,i)=>fetch("http://127.0.0.1:"+port+"/mcp",{method:"POST",headers:{"content-type":"application/json","mcp-protocol-version":"2026-07-28","connection":"close"},body:JSON.stringify({jsonrpc:"2.0",id:i+1,method:"tools/call",params:{name:"deen_verify_answer",arguments:{answer:validBody().answer,evidence_json:JSON.stringify(evidence),citations_json:JSON.stringify(citations)}}}),signal:AbortSignal.timeout(5000)})));
  assert.equal(results.length,40);
  const payloads=await Promise.all(results.map(r=>r.json()));
  assert.equal(payloads.filter(x=>x.result?.structuredContent?.verified===true).length,40);
 }finally{await stop(server);}
});
