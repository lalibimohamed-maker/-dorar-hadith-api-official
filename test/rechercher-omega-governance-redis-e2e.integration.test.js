import test from "node:test";
import assert from "node:assert/strict";
import { createAiGateway } from "../src/rechercher-ai-gateway.js";
import { createMcpServer } from "../src/rechercher-ai-mcp-server.js";
import { createRedisConversationMemory, sha256 } from "../src/rechercher-omega-redis-memory.js";
import { verifyEvidenceGate } from "../src/rechercher-omega-evidence-gate.js";

async function waitForListening(server){
  if(server.listening) return;
  await new Promise((resolve,reject)=>{
    server.once("listening",resolve);
    server.once("error",reject);
  });
}

async function stopServer(server){
  server.closeAllConnections?.();
  if(server.listening) await new Promise(resolve=>server.close(resolve));
}

async function postJson(url,body,headers={}){
  const response=await fetch(url,{
    method:"POST",
    headers:{"content-type":"application/json","connection":"close",...headers},
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(5000)
  });
  return {status:response.status,body:await response.json()};
}

function evidence(){
  const text="إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ";
  return [{
    sourceId:"bukhari-1",
    citation:"sahih-bukhari|1|page-1",
    kind:"primary_text",
    exact_quote_required:true,
    text,
    sha256:sha256(text),
    provenance:{source:"Sahih al-Bukhari",document_id:"fixture-bukhari-1",page:1}
  }];
}

function citations(){
  return [{sourceId:"bukhari-1",citation:"sahih-bukhari|1|page-1",text_hash:sha256(evidence()[0].text)}];
}

test("deterministic evidence gate rejects byte/diacritic/hash mutations",{timeout:5000},()=>{
  const source=evidence();

  assert.equal(
    verifyEvidenceGate({answer:`قال رسول الله ﷺ: "${source[0].text}".`,evidence:source,citations:citations()}).ok,
    true
  );

  assert.throws(
    ()=>verifyEvidenceGate({
      answer:'قال رسول الله ﷺ: "إِنَّمَا الأَعْمَالُ بالنيات".',
      evidence:source,
      citations:citations()
    }),
    /STRICT_ALIGNMENT_MISMATCH/
  );

  assert.throws(
    ()=>verifyEvidenceGate({
      answer:'قال رسول الله ﷺ: "إنما الأعمال بالنية".',
      evidence:source,
      citations:citations()
    }),
    /STRICT_ALIGNMENT_MISMATCH/
  );

  const tampered=[{...source[0],text:"إِنَّمَا الأَعْمَالُ بالنِّيَّاتِ"}];
  assert.throws(
    ()=>verifyEvidenceGate({
      answer:"إِنَّمَا الأَعْمَالُ بالنِّيَّاتِ",
      evidence:tampered,
      citations:[citations()[0]]
    }),
    /EVIDENCE_TEXT_HASH_MISMATCH/
  );
});

test("API end-to-end passes only exact source text and fails closed without evidence",{timeout:10000},async()=>{
  const server=createAiGateway({host:"127.0.0.1",port:0,ratePerMinute:10000,rateBurst:1000});
  await waitForListening(server);
  try{
    const port=server.address().port;
    const good=await postJson(`http://127.0.0.1:${port}/api/v1/agents/verify`,{
      answer:`قال رسول الله ﷺ: "${evidence()[0].text}".`,
      evidence:evidence(),
      citations:citations()
    });
    assert.equal(good.status,200);
    assert.equal(good.body.data.verified,true);
    assert.equal(good.body.data.error,null);

    const mutated=await postJson(`http://127.0.0.1:${port}/api/v1/agents/verify`,{
      answer:'قال رسول الله ﷺ: "إنما الأعمال بالنية".',
      evidence:evidence(),
      citations:citations()
    });
    assert.equal(mutated.status,422);
    assert.equal(mutated.body.data.verified,false);
    assert.equal(mutated.body.data.error.code,"STRICT_ALIGNMENT_MISMATCH");
    assert.equal(mutated.body.data.fallback,evidence()[0].text);

    const noEvidence=await postJson(`http://127.0.0.1:${port}/api/v1/agents/verify`,{
      answer:"إجابة من ذاكرة النموذج",
      evidence:[],
      citations:[]
    });
    assert.equal(noEvidence.status,422);
    assert.equal(noEvidence.body.data.verified,false);
    assert.equal(noEvidence.body.data.error.code,"NO_EVIDENCE_FOUND");

    const badEvidenceHash=await postJson(`http://127.0.0.1:${port}/api/v1/agents/verify`,{
      answer:evidence()[0].text,
      evidence:[{...evidence()[0],sha256:"0".repeat(64)}],
      citations:citations()
    });
    assert.equal(badEvidenceHash.status,422);
    assert.equal(badEvidenceHash.body.data.error.code,"EVIDENCE_TEXT_HASH_MISMATCH");
  }finally{
    await stopServer(server);
  }
});

test("MCP end-to-end exposes the same strict gate and no Corpus-write path",{timeout:10000},async()=>{
  const server=createMcpServer({host:"127.0.0.1",port:0,ratePerMinute:10000,rateBurst:1000});
  await waitForListening(server);
  try{
    const port=server.address().port;
    const call=async(id,answer,source=evidence(),citationSet=citations())=>postJson(`http://127.0.0.1:${port}/mcp`,{
      jsonrpc:"2.0",
      id,
      method:"tools/call",
      params:{
        name:"deen_verify_answer",
        arguments:{
          answer,
          evidence_json:JSON.stringify(source),
          citations_json:JSON.stringify(citationSet)
        }
      }
    },{"mcp-protocol-version":"2026-07-28"});

    const list=await postJson(`http://127.0.0.1:${port}/mcp`,{
      jsonrpc:"2.0",
      id:0,
      method:"tools/list"
    },{"mcp-protocol-version":"2026-07-28"});
    assert.equal(list.status,200);
    assert.ok(list.body.result.tools.some(tool=>tool.name==="deen_verify_answer"));
    assert.equal(list.body.result.tools.some(tool=>/write.*corpus|corpus.*write/i.test(tool.name+" "+tool.description)),false);

    const good=await call(1,evidence()[0].text);
    assert.equal(good.status,200);
    assert.equal(good.body.result.isError,false);
    assert.equal(good.body.result.structuredContent.verified,true);

    const mutated=await call(2,"إنما الأعمال بالنية.");
    assert.equal(mutated.status,200);
    assert.equal(mutated.body.result.isError,true);
    assert.equal(mutated.body.result.structuredContent.error.code,"STRICT_ALIGNMENT_MISMATCH");
    assert.equal(mutated.body.result.structuredContent.fallback,evidence()[0].text);

    const none=await call(3,"إجابة من الذاكرة",[],[]);
    assert.equal(none.status,200);
    assert.equal(none.body.result.isError,true);
    assert.equal(none.body.result.structuredContent.error.code,"NO_EVIDENCE_FOUND");
  }finally{
    await stopServer(server);
  }
});

test("parallel API/MCP verification plus Redis memory remain bounded and fail closed",{timeout:20000},async(t)=>{
  const redis=createRedisConversationMemory({
    host:process.env.REDIS_HOST||"127.0.0.1",
    port:Number(process.env.REDIS_PORT||6379),
    ttlSeconds:3600,
    maxTurns:64,
    keyPrefix:"ci:dinullah:omega-e2e:"
  });

  let redisReady=false;
  try{
    redisReady=await redis.ping();
  }catch(error){
    if(process.env.REQUIRE_REDIS_E2E==="1") throw error;
  }
  if(!redisReady){
    await redis.close();
    t.skip("Redis E2E is not configured; the CI workflow enables REQUIRE_REDIS_E2E=1.");
    return;
  }

  const api=createAiGateway({host:"127.0.0.1",port:0,ratePerMinute:10000,rateBurst:1000});
  const mcp=createMcpServer({host:"127.0.0.1",port:0,ratePerMinute:10000,rateBurst:1000});
  await Promise.all([waitForListening(api),waitForListening(mcp)]);

  const source=evidence();
  const goodAnswer=source[0].text;
  const badAnswer="إنما الأعمال بالنية.";

  try{
    const apiPort=api.address().port;
    const mcpPort=mcp.address().port;

    const apiRequests=Array.from({length:100},(_,index)=>
      postJson(`http://127.0.0.1:${apiPort}/api/v1/agents/verify`,{
        answer:index%2===0?goodAnswer:badAnswer,
        evidence:source,
        citations:citations()
      })
    );

    const mcpRequests=Array.from({length:100},(_,index)=>postJson(`http://127.0.0.1:${mcpPort}/mcp`,{
      jsonrpc:"2.0",
      id:index+1,
      method:"tools/call",
      params:{
        name:"deen_verify_answer",
        arguments:{
          answer:index%2===0?goodAnswer:badAnswer,
          evidence_json:JSON.stringify(source),
          citations_json:JSON.stringify(citations())
        }
      }
    },{"mcp-protocol-version":"2026-07-28"}));

    const [apiResponses,mcpResponses]=await Promise.all([
      Promise.all(apiRequests),
      Promise.all(mcpRequests)
    ]);

    assert.equal(apiResponses.length,100);
    assert.equal(apiResponses.filter(r=>r.status===200).length,50);
    assert.equal(apiResponses.filter(r=>r.status===422).length,50);
    apiResponses.forEach((response,index)=>{
      if(index%2===0){
        assert.equal(response.body.data.verified,true);
      }else{
        assert.equal(response.body.data.verified,false);
        assert.equal(response.body.data.error.code,"STRICT_ALIGNMENT_MISMATCH");
        assert.equal(response.body.data.fallback,goodAnswer);
      }
    });

    assert.equal(mcpResponses.length,100);
    assert.equal(mcpResponses.filter(r=>r.status===200).length,100);
    mcpResponses.forEach((response,index)=>{
      const structured=response.body.result.structuredContent;
      if(index%2===0){
        assert.equal(response.body.result.isError,false);
        assert.equal(structured.verified,true);
      }else{
        assert.equal(response.body.result.isError,true);
        assert.equal(structured.error.code,"STRICT_ALIGNMENT_MISMATCH");
        assert.equal(structured.fallback,goodAnswer);
      }
    });

    const sessionId="parallel-session-e2e";
    await redis.clear({sessionId});

    await Promise.all(Array.from({length:100},(_,index)=>
      redis.appendDigest({
        sessionId,
        role:index%2===0?"user":"assistant",
        content:index%2===0?`سؤال-${index}`:`رد-${index}`,
        evidenceIds:["bukhari-1"],
        outputSha256:index%2===0?null:sha256(goodAnswer),
        verified:index%2!==0
      })
    ));

    const rows=await redis.snapshotDigests({sessionId});
    assert.equal(rows.length,64);
    assert.ok((await redis.ttl({sessionId}))>0);

    const rawLeak=rows.some(row=>/سؤال-|رد-/.test(row));
    assert.equal(rawLeak,false);
    rows.forEach(row=>{
      const parsed=JSON.parse(row);
      assert.equal(typeof parsed.content_sha256,"string");
      assert.equal(parsed.content_sha256.length,64);
      assert.equal("content" in parsed,false);
    });

    await redis.clear({sessionId});
    assert.deepEqual(await redis.snapshotDigests({sessionId}),[]);
  }finally{
    await Promise.allSettled([stopServer(api),stopServer(mcp)]);
    await redis.close();
  }
});
