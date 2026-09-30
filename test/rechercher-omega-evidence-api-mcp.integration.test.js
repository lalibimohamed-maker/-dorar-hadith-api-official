import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";

async function start(server){
  await once(server,"listening");
  server.unref();
  return server.address().port;
}
async function stop(server){
  server.closeAllConnections?.();
  if(server.listening) await new Promise(resolve=>server.close(resolve));
}
function requestJson(url,body,headers={}){
  return new Promise((resolve,reject)=>{
    const target=new URL(url);
    const payload=Buffer.from(JSON.stringify(body),"utf8");
    const req=http.request({
      hostname:target.hostname,
      port:Number(target.port),
      path:target.pathname+target.search,
      method:"POST",
      agent:false,
      timeout:5000,
      headers:{"content-type":"application/json","connection":"close","content-length":String(payload.length),...headers}
    },res=>{
      const chunks=[];
      res.setEncoding("utf8");
      res.on("data",chunk=>chunks.push(chunk));
      res.on("end",()=>{
        try{resolve({status:res.statusCode,body:JSON.parse(chunks.join(""))});}
        catch(error){reject(error);}
      });
    });
    req.on("timeout",()=>req.destroy(new Error("HTTP integration test timeout")));
    req.on("error",reject);
    req.end(payload);
  });
}

test("AI gateway exposes the strict evidence verifier",async()=>{
 const {createAiGateway}=await import("../src/rechercher-ai-gateway.js");
 const server=createAiGateway({host:"127.0.0.1",port:0});
 try{
  const port=await start(server);
  const evidence=[{sourceId:"bukhari",citation:"vol.1 p.1",kind:"primary_text",exact_quote_required:true,text:"إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ"}];
  const citations=[{sourceId:"bukhari",citation:"vol.1 p.1"}];
  const ok=await requestJson("http://127.0.0.1:"+port+"/api/v1/agents/verify",{answer:"قال رسول الله ﷺ: إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ.",evidence,citations});
  assert.equal(ok.status,200); assert.equal(ok.body.data.verified,true);
  const bad=await requestJson("http://127.0.0.1:"+port+"/api/v1/agents/verify",{answer:"قال رسول الله ﷺ: إنما الأعمال بالنية.",evidence,citations});
  assert.equal(bad.status,422); assert.equal(bad.body.data.verified,false); assert.equal(bad.body.data.error.code,"STRICT_ALIGNMENT_MISMATCH"); assert.equal(bad.body.data.fallback,evidence[0].text);
  const none=await requestJson("http://127.0.0.1:"+port+"/api/v1/agents/verify",{answer:"ذاكرة النموذج",evidence:[],citations:[]});
  assert.equal(none.status,422); assert.equal(none.body.data.error.code,"NO_EVIDENCE_FOUND");
 }finally{await stop(server);}
});

test("MCP exposes the same strict verifier as a read-only tool",async()=>{
 const {createMcpServer}=await import("../src/rechercher-ai-mcp-server.js");
 const server=createMcpServer({host:"127.0.0.1",port:0});
 try{
  const port=await start(server);
  const evidence=[{sourceId:"bukhari",citation:"vol.1 p.1",kind:"primary_text",exact_quote_required:true,text:"إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ"}];
  const payload={jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"deen_verify_answer",arguments:{answer:"إنما الأعمال بالنية.",evidence_json:JSON.stringify(evidence),citations_json:JSON.stringify([{sourceId:"bukhari",citation:"vol.1 p.1"}])}}};
  const res=await requestJson("http://127.0.0.1:"+port+"/mcp",payload,{"mcp-protocol-version":"2026-07-28"});
  const structured=res.body.result.structuredContent;
  assert.equal(res.status,200); assert.equal(res.body.result.isError,true); assert.equal(structured.verified,false); assert.equal(structured.error.code,"STRICT_ALIGNMENT_MISMATCH"); assert.equal(structured.fallback,evidence[0].text);
 }finally{await stop(server);}
});
