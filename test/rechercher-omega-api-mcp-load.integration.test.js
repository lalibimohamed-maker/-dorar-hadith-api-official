import test from "node:test";
import assert from "node:assert/strict";

test("AI API verifier survives concurrent fail/green requests without leaking rejected text",async()=>{
 const {createAiGateway}=await import("../src/rechercher-ai-gateway.js");
 const server=createAiGateway({host:"127.0.0.1",port:0,ratePerMinute:10000,rateBurst:1000});
 const port=server.address().port;
 const evidence=[{sourceId:"b",citation:"p.1",kind:"primary_text",exact_quote_required:true,text:"النص الموثق"}];
 try{
  const requests=Array.from({length:120},(_,i)=>{
   const good=i%2===0;
   return fetch("http://127.0.0.1:"+port+"/api/v1/agents/verify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({answer:good?"النص الموثق":"نص محرف",evidence,citations:[{sourceId:"b",citation:"p.1"}]})});
  });
  const responses=await Promise.all(requests);
  assert.equal(responses.length,40);
  const statuses=await Promise.all(responses.map(r=>r.status));
  assert.equal(statuses.filter(s=>s===200).length,20);
  assert.equal(statuses.filter(s=>s===422).length,60);
 }finally{server.closeAllConnections?.();await new Promise(resolve=>{const t=setTimeout(resolve,1000);server.close(()=>{clearTimeout(t);resolve();});});}
});

test("MCP tool discovery survives 120 concurrent read-only requests",async()=>{
 const {createMcpServer}=await import("../src/rechercher-ai-mcp-server.js");
 const server=createMcpServer({host:"127.0.0.1",port:0,ratePerMinute:10000,rateBurst:1000});
 const port=server.address().port;
 try{
  const payload=JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/list"});
  const responses=await Promise.all(Array.from({length:120},()=>fetch("http://127.0.0.1:"+port+"/mcp",{method:"POST",headers:{"content-type":"application/json","mcp-protocol-version":"2026-07-28"},body:payload})));
  assert.equal(responses.filter(r=>r.status===200).length,120);
  const bodies=await Promise.all(responses.map(r=>r.json()));
  assert.ok(bodies.every(b=>Array.isArray(b.result?.tools)));
  assert.ok(bodies[0].result.tools.some(t=>t.name==="deen_verify_answer"));
 }finally{server.closeAllConnections?.();await new Promise(resolve=>{const t=setTimeout(resolve,1000);server.close(()=>{clearTimeout(t);resolve();});});}
});
