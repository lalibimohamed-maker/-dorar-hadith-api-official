import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

async function start(server){
  await once(server,"listening");
  return server.address().port;
}
async function shutdown(server){
  if(typeof server.closeAllConnections==="function") server.closeAllConnections();
  if(server.listening) await new Promise(resolve=>server.close(resolve));
}
async function requestJson(url,body,headers={}){
  const res=await fetch(url,{method:"POST",headers:{"content-type":"application/json","connection":"close",...headers},signal:AbortSignal.timeout(3000),body:JSON.stringify(body)});
  return {status:res.status,body:await res.json()};
}

test("AI gateway exposes the strict evidence verifier",{timeout:8000},async()=>{
  const {createAiGateway}=await import("../src/rechercher-ai-gateway.js");
  const server=createAiGateway({host:"127.0.0.1",port:0});
  try{
    const port=await start(server);
    const evidence=[{
      sourceId:"bukhari",evidence_id:"h:1",citation:"vol.1 p.1",kind:"primary_text",type:"hadith",
      exact_quote_required:true,text:"إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ",sha256:"b0282fe41fa1cd9e3224fcf46fbd7180eb6c954396bfcb7b92a858e0220c9c28",
      source:"sahih-bukhari",document_id:"bukhari:1",rights_status:"cleared",provenance:"verified",
      verification_status:"verified",authenticity_status:"sahih"
    }];
    const citations=[{sourceId:"bukhari",citation:"vol.1 p.1",text_hash:"b0282fe41fa1cd9e3224fcf46fbd7180eb6c954396bfcb7b92a858e0220c9c28"}];
    const ok=await requestJson("http://127.0.0.1:"+port+"/api/v1/agents/verify",{answer:"قال رسول الله ﷺ: إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ.",evidence,citations});
    assert.equal(ok.status,200); assert.equal(ok.body.data.verified,true);
    const bad=await requestJson("http://127.0.0.1:"+port+"/api/v1/agents/verify",{answer:"قال رسول الله ﷺ: إنما الأعمال بالنية.",evidence,citations});
    assert.equal(bad.status,422); assert.equal(bad.body.data.verified,false); assert.equal(bad.body.data.error.code,"STRICT_ALIGNMENT_MISMATCH"); assert.equal(bad.body.data.fallback,evidence[0].text);
    const none=await requestJson("http://127.0.0.1:"+port+"/api/v1/agents/verify",{answer:"ذاكرة النموذج",evidence:[],citations:[]});
    assert.equal(none.status,422); assert.equal(none.body.data.error.code,"NO_EVIDENCE_FOUND");

    const forgedClaim=await requestJson("http://127.0.0.1:"+port+"/api/v1/agents/verify",{
      answer:evidence[0].text+". وهذا الحديث يدل على وجوب النية في العمل.",
      evidence,
      citations,
      claimProvenance:[{
        claim_text:"وهذا الحديث يدل على وجوب النية في العمل",
        verification_status:"verified",
        claim_sha256:"0".repeat(64),
        citations
      }]
    });
    assert.equal(forgedClaim.status,422);
    assert.equal(forgedClaim.body.data.error.code,"UNSUPPORTED_CLAIM");
  }finally{await shutdown(server);}
});

test("MCP exposes the same strict verifier as a read-only tool",{timeout:8000},async()=>{
  const {createMcpServer}=await import("../src/rechercher-ai-mcp-server.js");
  const server=createMcpServer({host:"127.0.0.1",port:0});
  try{
    const port=await start(server);
    const evidence=[{
      sourceId:"bukhari",evidence_id:"h:1",citation:"vol.1 p.1",kind:"primary_text",type:"hadith",
      exact_quote_required:true,text:"إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ",sha256:"b0282fe41fa1cd9e3224fcf46fbd7180eb6c954396bfcb7b92a858e0220c9c28",
      source:"sahih-bukhari",document_id:"bukhari:1",rights_status:"cleared",provenance:"verified",
      verification_status:"verified",authenticity_status:"sahih"
    }];
    const payload={jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"deen_verify_answer",arguments:{answer:"إنما الأعمال بالنية.",evidence_json:JSON.stringify(evidence),citations_json:JSON.stringify([{sourceId:"bukhari",citation:"vol.1 p.1",text_hash:"b0282fe41fa1cd9e3224fcf46fbd7180eb6c954396bfcb7b92a858e0220c9c28"}])}}};
    const res=await requestJson("http://127.0.0.1:"+port+"/mcp",payload,{"mcp-protocol-version":"2026-07-28"});
    const structured=res.body.result.structuredContent;
    assert.equal(res.status,200); assert.equal(res.body.result.isError,true); assert.equal(structured.verified,false); assert.equal(structured.error.code,"STRICT_ALIGNMENT_MISMATCH"); assert.equal(structured.fallback,evidence[0].text);
  }finally{await shutdown(server);}
});
