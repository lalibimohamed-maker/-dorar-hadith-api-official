import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

async function listeningPort(server) {
 await once(server, "listening");
 const address = server.address();
 assert.ok(address && typeof address === "object", "server must expose its bound address after listening");
 return address.port;
}

test("AI gateway handles concurrent strict verification requests",async()=>{
 process.env.AI_GATEWAY_RATE_PER_MINUTE="10000";
 process.env.AI_GATEWAY_BURST="1000";
 const {createAiGateway}=await import("../src/rechercher-ai-gateway.js");
 const server=createAiGateway({host:"127.0.0.1",port:0});
 try{
  const port=await listeningPort(server);
  const evidence=[{sourceId:"b",citation:"p.1",kind:"primary_text",exact_quote_required:true,text:"إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ"}];
  const body=JSON.stringify({answer:"إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ",evidence,citations:[{sourceId:"b",citation:"p.1"}]});
  const responses=await Promise.all(Array.from({length:100},()=>fetch("http://127.0.0.1:"+port+"/api/v1/agents/verify",{method:"POST",headers:{"content-type":"application/json"},body})));
  assert.equal(responses.filter(x=>x.status===200).length,100);
 }finally{if(server.listening)await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

test("MCP handles concurrent strict verification calls",async()=>{
 process.env.MCP_RATE_LIMIT_PER_MINUTE="10000";
 process.env.MCP_RATE_BURST="1000";
 const {createMcpServer}=await import("../src/rechercher-ai-mcp-server.js");
 const server=createMcpServer({host:"127.0.0.1",port:0});
 try{
  const port=await listeningPort(server);
  const evidence=[{sourceId:"b",citation:"p.1",kind:"primary_text",exact_quote_required:true,text:"إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ"}];
  const payload=JSON.stringify({jsonrpc:"2.0",method:"tools/call",id:1,params:{name:"deen_verify_answer",arguments:{answer:"إنما الأعمال بالنية.",evidence_json:JSON.stringify(evidence),citations_json:JSON.stringify([{sourceId:"b",citation:"p.1"}])}}});
  const responses=await Promise.all(Array.from({length:100},()=>fetch("http://127.0.0.1:"+port+"/mcp",{method:"POST",headers:{"content-type":"application/json","mcp-protocol-version":"2026-07-28"},body:payload})));
  const rows=await Promise.all(responses.map(r=>r.json()));
  assert.equal(responses.filter(x=>x.status===200).length,100);
  assert.equal(rows.filter(x=>x.result?.isError===true).length,100);
 }finally{if(server.listening)await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
