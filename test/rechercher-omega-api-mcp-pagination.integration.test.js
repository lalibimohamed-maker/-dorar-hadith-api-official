import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";

async function start(server){if(!server.listening)await once(server,"listening");return server.address().port;}
async function stop(server){if(server.closeAllConnections)server.closeAllConnections();if(server.listening)await new Promise(resolve=>{let done=false;const finish=()=>{if(!done){done=true;resolve();}};server.close(finish);setTimeout(finish,250);});}

function pagedMatches(reqUrl){
 const u=new URL(reqUrl,"http://upstream"); const cursor=u.searchParams.get("cursor");
 if(!cursor)return {sourceMatches:[{id:"1"},{id:"2"}],pagination:{next_cursor:"c2"}};
 if(cursor==="c2")return {sourceMatches:[{id:"3"}],pagination:{next_cursor:null}};
 return {sourceMatches:[],pagination:{next_cursor:null}};
}

test("AI gateway search cursor forwards source pagination",async()=>{
 const upstream=http.createServer((req,res)=>{const body=pagedMatches(req.url);res.writeHead(200,{"content-type":"application/json"});res.end(JSON.stringify(body));});
 const upstreamPort=await start(upstream); process.env.DEEN_ALLAH_API_BASE="http://127.0.0.1:"+upstreamPort; process.env.AI_GATEWAY_RATE_PER_MINUTE="1000";process.env.AI_GATEWAY_BURST="100";
 const mod=await import("../src/rechercher-ai-gateway.js?pagination-test-ai"); const server=mod.createAiGateway({host:"127.0.0.1",port:0});
 try{
  const port=await start(server);
  const first=await fetch("http://127.0.0.1:"+port+"/api/v1/agents/search?q=x&limit=2",{signal:AbortSignal.timeout(5000)}); const a=await first.json();
  assert.equal(first.status,200);assert.equal(a.data.sourceMatches.length,2);assert.equal(a.data.pagination.next_cursor,"c2");
  const next=await fetch("http://127.0.0.1:"+port+"/api/v1/agents/search?q=x&limit=2&cursor=c2",{signal:AbortSignal.timeout(5000)}); const b=await next.json();
  assert.equal(next.status,200);assert.equal(b.data.sourceMatches.length,1);assert.equal(b.data.pagination.next_cursor,null);
 }finally{await stop(server);await stop(upstream);}
});

test("MCP search cursor forwards source pagination",async()=>{
 const upstream=http.createServer((req,res)=>{const body=pagedMatches(req.url);res.writeHead(200,{"content-type":"application/json"});res.end(JSON.stringify(body));});
 const upstreamPort=await start(upstream); process.env.DEEN_ALLAH_API_BASE="http://127.0.0.1:"+upstreamPort; process.env.MCP_RATE_LIMIT_PER_MINUTE="1000";process.env.MCP_RATE_BURST="100";
 const mod=await import("../src/rechercher-ai-mcp-server.js?pagination-test-mcp"); const server=mod.createMcpServer({host:"127.0.0.1",port:0});
 try{
  const port=await start(server);
  const call=args=>fetch("http://127.0.0.1:"+port+"/mcp",{method:"POST",headers:{"content-type":"application/json","mcp-protocol-version":"2026-07-28","connection":"close"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"deen_search",arguments:args}}),signal:AbortSignal.timeout(5000)});
  const first=await call({q:"x",limit:2});const a=await first.json();assert.equal(first.status,200);assert.equal(a.result.structuredContent.sourceMatches.length,2);assert.equal(a.result.structuredContent.pagination.next_cursor,"c2");
  const second=await call({q:"x",limit:2,cursor:"c2"});const b=await second.json();assert.equal(second.status,200);assert.equal(b.result.structuredContent.sourceMatches.length,1);assert.equal(b.result.structuredContent.pagination.next_cursor,null);
 }finally{await stop(server);await stop(upstream);}
});
