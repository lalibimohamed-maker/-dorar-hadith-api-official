import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

test("AI gateway search cursor is real and query-bound",async()=>{
  const upstream=http.createServer((req,res)=>{
    const body={sourceMatches:[{id:"1"},{id:"2"},{id:"3"}],query:"x"};
    res.writeHead(200,{"content-type":"application/json"}); res.end(JSON.stringify(body));
  });
  await new Promise(resolve=>upstream.listen(0,"127.0.0.1",resolve));
  const upstreamPort=upstream.address().port;
  process.env.DEEN_ALLAH_API_BASE="http://127.0.0.1:"+upstreamPort;
  process.env.AI_GATEWAY_RATE_PER_MINUTE="1000"; process.env.AI_GATEWAY_BURST="100";
  const mod=await import("../src/rechercher-ai-gateway.js?pagination-test");
  const server=mod.createAiGateway({host:"127.0.0.1",port:0});
  const port=server.address().port;
  try{
    const first=await fetch("http://127.0.0.1:"+port+"/api/v1/agents/search?q=x&limit=2");
    const a=await first.json();
    assert.equal(first.status,200); assert.equal(a.data.sourceMatches.length,2); assert.ok(a.data.pagination.next_cursor);
    const next=await fetch("http://127.0.0.1:"+port+"/api/v1/agents/search?q=x&limit=2&cursor="+encodeURIComponent(a.data.pagination.next_cursor));
    const b=await next.json();
    assert.equal(next.status,200); assert.equal(b.data.sourceMatches.length,1); assert.equal(b.data.pagination.next_cursor,null);
    const bad=await fetch("http://127.0.0.1:"+port+"/api/v1/agents/search?q=y&limit=2&cursor="+encodeURIComponent(a.data.pagination.next_cursor));
    const badBody=await bad.json();
    assert.equal(bad.status,400); assert.equal(badBody.error.code,"INVALID_CURSOR");
  }finally{
    await new Promise(resolve=>server.close(resolve));
    await new Promise(resolve=>upstream.close(resolve));
  }
});

test("MCP search cursor paginates sourceMatches",async()=>{
  const upstream=http.createServer((req,res)=>{
    const body={sourceMatches:[{id:"1"},{id:"2"},{id:"3"}]};
    res.writeHead(200,{"content-type":"application/json"}); res.end(JSON.stringify(body));
  });
  await new Promise(resolve=>upstream.listen(0,"127.0.0.1",resolve));
  process.env.DEEN_ALLAH_API_BASE="http://127.0.0.1:"+upstream.address().port;
  process.env.MCP_RATE_LIMIT_PER_MINUTE="1000"; process.env.MCP_RATE_BURST="100";
  const mod=await import("../src/rechercher-ai-mcp-server.js?pagination-test");
  const server=mod.createMcpServer({host:"127.0.0.1",port:0});
  const port=server.address().port;
  try{
    const call=requestArguments=>fetch("http://127.0.0.1:"+port+"/mcp",{method:"POST",headers:{"content-type":"application/json","mcp-protocol-version":"2026-07-28"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"deen_search",arguments:requestArguments}})});
    const first=await call({q:"x",limit:2}); const a=await first.json();
    assert.equal(first.status,200); assert.equal(a.result.structuredContent.sourceMatches.length,2); assert.ok(a.result.structuredContent.pagination.next_cursor);
    const second=await call({q:"x",limit:2,cursor:a.result.structuredContent.pagination.next_cursor}); const b=await second.json();
    assert.equal(second.status,200); assert.equal(b.result.structuredContent.sourceMatches.length,1);
  }finally{
    await new Promise(resolve=>server.close(resolve));
    await new Promise(resolve=>upstream.close(resolve));
  }
});
