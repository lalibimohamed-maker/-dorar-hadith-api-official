import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

test("AI gateway exposes the strict evidence verifier",async()=>{
 const {createAiGateway}=await import("../src/rechercher-ai-gateway.js");
 const server=createAiGateway({host:"127.0.0.1",port:0});
 await once(server,"listening");
 const port=server.address().port;
 try{
  const body={answer:"قال رسول الله ﷺ: إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ.",evidence:[{sourceId:"bukhari",citation:"vol.1 p.1",kind:"primary_text",exact_quote_required:true,text:"إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ"}],citations:[{sourceId:"bukhari",citation:"vol.1 p.1"}]};
  const ok=await fetch("http://127.0.0.1:"+port+"/api/v1/agents/verify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  const good=await ok.json(); assert.equal(ok.status,200); assert.equal(good.data.verified,true);
  const badBody={...body,answer:"قال رسول الله ﷺ: إنما الأعمال بالنية."};
  const bad=await fetch("http://127.0.0.1:"+port+"/api/v1/agents/verify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(badBody)});
  const rejected=await bad.json(); assert.equal(bad.status,422); assert.equal(rejected.data.verified,false); assert.equal(rejected.data.error.code,"STRICT_ALIGNMENT_MISMATCH"); assert.equal(rejected.data.fallback,body.evidence[0].text);
  const none=await fetch("http://127.0.0.1:"+port+"/api/v1/agents/verify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({answer:"ذاكرة النموذج",evidence:[],citations:[]})});
  const empty=await none.json(); assert.equal(none.status,422); assert.equal(empty.data.error.code,"NO_EVIDENCE_FOUND");
 }finally{server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));}
});

test("MCP exposes the same strict verifier as a read-only tool",async()=>{
 const {createMcpServer}=await import("../src/rechercher-ai-mcp-server.js");
 const server=createMcpServer({host:"127.0.0.1",port:0});
 await once(server,"listening");
 const port=server.address().port;
 try{
  const evidence=[{sourceId:"bukhari",citation:"vol.1 p.1",kind:"primary_text",exact_quote_required:true,text:"إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ"}];
  const payload={jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"deen_verify_answer",arguments:{answer:"إنما الأعمال بالنية.",evidence_json:JSON.stringify(evidence),citations_json:JSON.stringify([{sourceId:"bukhari",citation:"vol.1 p.1"}])}}};
  const res=await fetch("http://127.0.0.1:"+port+"/mcp",{method:"POST",headers:{"content-type":"application/json","mcp-protocol-version":"2026-07-28"},body:JSON.stringify(payload)});
  const data=await res.json();
  const structured=data.result.structuredContent;
  assert.equal(res.status,200); assert.equal(data.result.isError,true); assert.equal(structured.verified,false); assert.equal(structured.error.code,"STRICT_ALIGNMENT_MISMATCH"); assert.equal(structured.fallback,evidence[0].text);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
