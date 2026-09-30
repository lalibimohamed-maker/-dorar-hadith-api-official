import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

process.env.AI_GATEWAY_RATE_PER_MINUTE="10000";
process.env.AI_GATEWAY_BURST="1000";
process.env.MCP_RATE_LIMIT_PER_MINUTE="10000";
process.env.MCP_RATE_BURST="1000";

async function start(server){ await once(server,"listening"); server.unref(); return server.address().port; }
async function stop(server){ server.closeAllConnections?.(); if(server.listening) await new Promise(resolve=>server.close(resolve)); }

test("AI API verifier survives concurrent fail/green requests without leaking rejected text",async()=>{
 const {createAiGateway}=await import("../src/rechercher-ai-gateway.js?loadtest=ai2");
 const server=createAiGateway({host:"127.0.0.1",port:0});
 const evidence=[{sourceId:"b",citation:"p.1",kind:"primary_text",exact_quote_required:true,text:"النص الموثق",sha256:"a42f213000e4d3f815dd57f95f6476c323d9b9db858804f7db2d55d169718d74"}];
 try{
  const port=await start(server);
  const requests=Array.from({length:40},(_,i)=>fetch("http://127.0.0.1:"+port+"/api/v1/agents/verify",{method:"POST",headers:{"content-type":"application/json","connection":"close"},body:JSON.stringify({answer:i%2===0?"النص الموثق":"نص محرف",evidence,citations:[{sourceId:"b",citation:"p.1"}]}),signal:AbortSignal.timeout(5000)}));
  const responses=await Promise.all(requests); assert.equal(responses.length,40);
  const statuses=responses.map(r=>r.status); assert.equal(statuses.filter(s=>s===200).length,20); assert.equal(statuses.filter(s=>s===422).length,20);
 }finally{await stop(server);}
});

test("MCP tool discovery survives 40 concurrent read-only requests",async()=>{
 const {createMcpServer}=await import("../src/rechercher-ai-mcp-server.js?loadtest=mcp2");
 const server=createMcpServer({host:"127.0.0.1",port:0});
 try{
  const port=await start(server);
  const payload=JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/list"});
  const responses=await Promise.all(Array.from({length:40},()=>fetch("http://127.0.0.1:"+port+"/mcp",{method:"POST",headers:{"content-type":"application/json","mcp-protocol-version":"2026-07-28","connection":"close"},body:payload,signal:AbortSignal.timeout(5000)})));
  assert.equal(responses.filter(r=>r.status===200).length,40);
  const bodies=await Promise.all(responses.map(r=>r.json())); assert.ok(bodies.every(b=>Array.isArray(b.result?.tools))); assert.ok(bodies[0].result.tools.some(t=>t.name==="deen_verify_answer"));
 }finally{await stop(server);}
});
