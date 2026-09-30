import http from "node:http";
import { verifyAgentAnswer } from "./rechercher-omega-answer-verifier.js";
import { MCP_STRICT_ANCHORING_VERSION, strictAnchoringDescription, buildStrictEvidenceRecord } from "./rechercher-ai/mcp-strict-anchoring.js";

export const MCP_PROTOCOL_VERSION = "2026-07-28";
export const SUPPORTED_MCP_VERSIONS = Object.freeze([MCP_PROTOCOL_VERSION, "2025-11-25"]);
const DEFAULT_BASE = process.env.DEEN_ALLAH_API_BASE || "http://127.0.0.1:3000";
const MAX_BODY = 1024 * 1024;
const RATE_LIMIT_PER_MINUTE = Number(process.env.MCP_RATE_LIMIT_PER_MINUTE || 60);
const RATE_BURST = Number(process.env.MCP_RATE_BURST || 20);
const rateBuckets = new Map();

export const TOOLS = Object.freeze([
  { name:"deen_search", annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true}, description:strictAnchoringDescription("deen_search")+"\nSearch the verified Din Allah API with cursor pagination. Search is discovery only; returned evidence must still pass provenance/rights/verification gates.", inputSchema:{type:"object",additionalProperties:false,required:["q"],properties:{q:{type:"string",minLength:1,maxLength:300},lang:{type:"string",maxLength:35},comparative:{type:"boolean"},limit:{type:"integer",minimum:1,maximum:100},cursor:{type:"string",maxLength:1024}}}},
  { name:"deen_concept", annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true}, description:strictAnchoringDescription("deen_concept")+"\nRetrieve a source-aware concept card from the encyclopedia.", inputSchema:{type:"object",additionalProperties:false,required:["term"],properties:{term:{type:"string",minLength:1,maxLength:300},context:{type:"string",maxLength:500},lang:{type:"string",maxLength:35}}}},
  { name:"deen_quran_ayah", annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true}, description:strictAnchoringDescription("deen_quran_ayah")+"\nRetrieve canonical Quran ayah context. The model is never permitted to generate or rewrite canonical Quran text.", inputSchema:{type:"object",additionalProperties:false,required:["verse"],properties:{verse:{type:"string",minLength:1,maxLength:80},translationIds:{type:"string",maxLength:500},tafsirIds:{type:"string",maxLength:500},words:{type:"boolean"}}}},
  { name:"deen_source", annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true}, description:strictAnchoringDescription("deen_source")+"\nRetrieve a named encyclopedia source record with provenance metadata.", inputSchema:{type:"object",additionalProperties:false,required:["id"],properties:{id:{type:"string",minLength:1,maxLength:200}}}},
  { name:"deen_verify_answer", annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true}, description:strictAnchoringDescription("deen_verify_answer")+"\nStrictly verify generated text against supplied source evidence. A mismatch is rejected and the exact source text is returned as deterministic fallback.", inputSchema:{type:"object",additionalProperties:false,required:["answer","evidence_json","citations_json"],properties:{answer:{type:"string",minLength:1,maxLength:20000},evidence_json:{type:"string",minLength:2,maxLength:500000},citations_json:{type:"string",minLength:2,maxLength:100000}}}},
  { name:"deen_health", annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true}, description:strictAnchoringDescription("deen_health")+"\nReturn API health information.", inputSchema:{type:"object",additionalProperties:false,properties:{}}}
]);

function json(res,status,payload,headers={}) {
  res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff",...headers});
  res.end(JSON.stringify(payload));
}

function protocolVersion(req,body) {
  return req.headers["mcp-protocol-version"] || body?._meta?.["io.modelcontextprotocol/protocolVersion"] || body?._meta?.["io.modelcontextprotocol/protocolVersion"] || null;
}

function clientAddress(req) { return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim(); }

function allowRequest(req,{perMinute=Number(process.env.MCP_RATE_LIMIT_PER_MINUTE||60),burst=Number(process.env.MCP_RATE_BURST||20)} = {}) {
  const now = Date.now();
  const key = clientAddress(req);
  const bucket = rateBuckets.get(key) || { tokens: burst, updated: now };
  const elapsed = Math.max(0, now - bucket.updated);
  bucket.tokens = Math.min(burst, bucket.tokens + (elapsed / 60000) * perMinute);
  bucket.updated = now;
  if (bucket.tokens < 1) { rateBuckets.set(key, bucket); return false; }
  bucket.tokens -= 1;
  rateBuckets.set(key, bucket);
  if (rateBuckets.size > 10000) {
    for (const [k,v] of rateBuckets) if (now - v.updated > 120000) rateBuckets.delete(k);
  }
  return true;
}

function rpcError(id,code,message,data) {
  return {jsonrpc:"2.0",id,error:{code,message,...(data===undefined?{}:{data})}};
}

function validateVersion(version,id) {
  if (!version || SUPPORTED_MCP_VERSIONS.includes(version)) return null;
  return rpcError(id,-32022,"Unsupported protocol version",{supported:SUPPORTED_MCP_VERSIONS,requested:version});
}

function readBody(req) {
  return new Promise((resolve,reject)=>{
    let size=0, chunks=[];
    req.on("data",chunk=>{size+=chunk.length;if(size>MAX_BODY){req.destroy();reject(new Error("request body too large"));return;}chunks.push(chunk);});
    req.on("end",()=>resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error",reject);
  });
}

function encodeCursor(payload){return Buffer.from(JSON.stringify(payload),"utf8").toString("base64url");}
function decodeCursor(cursor){
  if(!cursor)return {offset:0,q:null};
  try{
    const value=JSON.parse(Buffer.from(String(cursor),"base64url").toString("utf8"));
    if(!Number.isInteger(value.offset)||value.offset<0||value.offset>1000000)throw new Error("invalid offset");
    return {offset:value.offset,q:value.q==null?null:String(value.q)};
  }catch{throw new Error("INVALID_CURSOR: cursor is invalid");}
}
function paginateSearch(data,{q,cursor,limit}){
  const items=Array.isArray(data?.sourceMatches)?data.sourceMatches:[];
  const upstreamPagination=data?.pagination;
  if(upstreamPagination && Object.prototype.hasOwnProperty.call(upstreamPagination,"next_cursor")){
    return {...data,pagination:{...upstreamPagination,limit,cursor:cursor??upstreamPagination.cursor??null,total:upstreamPagination.total??items.length,next_cursor:upstreamPagination.next_cursor??null}};
  }
  const page=decodeCursor(cursor);
  if(page.q!==null&&page.q!==q)throw new Error("INVALID_CURSOR: cursor does not belong to this query");
  const start=page.offset, end=Math.min(items.length,start+limit);
  return {...data,sourceMatches:items.slice(start,end),pagination:{limit,cursor:cursor||null,next_cursor:end<items.length?encodeCursor({q,offset:end}):null,total:items.length}};
}

function tool(name) { return TOOLS.find(x=>x.name===name) || null; }

function validateArguments(def,args={}) {
  if (!args || typeof args!=="object" || Array.isArray(args)) throw new Error("tool arguments must be an object");
  for (const key of Object.keys(args)) if (!def.inputSchema.properties?.[key]) throw new Error(`unknown tool argument: ${key}`);
  for (const key of def.inputSchema.required || []) {
    if (typeof args[key] !== "string" || !args[key].trim()) throw new Error(`missing required argument: ${key}`);
  }
}

function buildUrl(name,args) {
  const url=new URL(DEFAULT_BASE);
  if(name==="deen_search"){url.pathname="/api/v1/search";url.search=new URLSearchParams({q:args.q,...(args.lang?{lang:args.lang}:{}),...(args.comparative!==undefined?{comparative:String(args.comparative)}:{}),...(args.limit?{limit:String(args.limit)}:{}),...(args.cursor?{cursor:String(args.cursor)}:{})}).toString();}
  else if(name==="deen_concept"){url.pathname="/api/v1/concept";url.search=new URLSearchParams({term:args.term,...(args.context?{context:args.context}:{}),...(args.lang?{lang:args.lang}:{})}).toString();}
  else if(name==="deen_quran_ayah"){url.pathname="/api/v1/quran/ayah";url.search=new URLSearchParams({verse:args.verse,...(args.translationIds?{translationIds:args.translationIds}:{}),...(args.tafsirIds?{tafsirIds:args.tafsirIds}:{}),...(args.words!==undefined?{words:String(args.words)}:{})}).toString();}
  else if(name==="deen_source"){url.pathname="/api/v1/encyclopedia/source/"+encodeURIComponent(args.id);}
  else if(name==="deen_health"){url.pathname="/health";}
  else throw new Error("unknown tool");
  return url;
}

async function callApi(name,args) {
  const url=buildUrl(name,args);
  const headers={"accept":"application/json"};
  if(process.env.DEEN_ALLAH_API_KEY) headers["x-api-key"]=process.env.DEEN_ALLAH_API_KEY;
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(15000)});
  const text=await response.text();
  let data;
  try { data=JSON.parse(text); } catch { data={raw:text}; }
  if(!response.ok) {
    const error=new Error(`Din Allah API returned HTTP ${response.status}`);
    error.data={status:response.status,body:data};
    throw error;
  }
  return data;
}

function mcpResult(id,result) {
  return {jsonrpc:"2.0",id,result:{...result,_meta:{"io.modelcontextprotocol/serverInfo":{name:"din-allah-rechercher-mcp",version:"1.0.0",anchoring_version:MCP_STRICT_ANCHORING_VERSION}}}};
}

async function executeVerifyAnswer(args){
  let evidence,citations;
  try{
    evidence=JSON.parse(args.evidence_json);
    citations=JSON.parse(args.citations_json);
  }catch(error){
    return {__mcp_error:true,value:{code:"INVALID_VERIFICATION_JSON",message:error.message}};
  }

  const anchoredEvidence=buildStrictEvidenceRecord(evidence);
  const data=verifyAgentAnswer({
    answer:args.answer,
    evidence:evidence.map((item,index)=>({
      ...item,
      text_hash:item?.text_hash ?? anchoredEvidence[index]?.text_sha256 ?? undefined
    })),
    citations
  });
  return data;
}

async function executeApiTool(name,args){
  return callApi(name,args);
}

async function executeSearch(args){
  const data=await callApi("deen_search",args);
  return paginateSearch(data,{
    q:args.q,
    cursor:args.cursor||null,
    limit:Number(args.limit||20)
  });
}

const TOOL_EXECUTORS=Object.freeze(new Map([
  ["deen_search",executeSearch],
  ["deen_concept",args=>executeApiTool("deen_concept",args)],
  ["deen_quran_ayah",args=>executeApiTool("deen_quran_ayah",args)],
  ["deen_source",args=>executeApiTool("deen_source",args)],
  ["deen_verify_answer",executeVerifyAnswer],
  ["deen_health",args=>executeApiTool("deen_health",args)]
]));

async function handleRpc(req,body) {
  const id=body.id ?? null;
  const version=protocolVersion(req,body);
  const versionError=validateVersion(version,id);
  if(versionError) return versionError;
  switch(body.method){
    case "server/discover":
      return mcpResult(id,{protocolVersions:SUPPORTED_MCP_VERSIONS,capabilities:{tools:{listChanged:false}},serverInfo:{name:"din-allah-rechercher-mcp",version:"1.0.0",anchoring_version:MCP_STRICT_ANCHORING_VERSION}});
    case "tools/list":
      return mcpResult(id,{tools:TOOLS});
    case "tools/call":{
      const name=body.params?.name;
      const def=tool(name);
      if(!def) return rpcError(id,-32602,"Unknown tool",{name});
      try{
        const args=body.params?.arguments || {};
        validateArguments(def,args);
        const executor=TOOL_EXECUTORS.get(name);
        if(!executor) return rpcError(id,-32602,"Unknown tool",{name});
        const data=await executor(args);
        const isError=Boolean(data?.__mcp_error);
        if(isError){
          return mcpResult(id,{content:[{type:"text",text:JSON.stringify(data.value)}],structuredContent:data.value,isError:true});
        }
        return mcpResult(id,{content:[{type:"text",text:JSON.stringify(data)}],structuredContent:data,isError:false});
      }catch(error){
        return mcpResult(id,{content:[{type:"text",text:JSON.stringify({code:"UPSTREAM_ERROR",message:error.message,data:error.data||null})}],isError:true});
      }
    }
    default:
      return rpcError(id,-32601,"Method not found",{method:body.method});
  }
}

export function createMcpServer({host="0.0.0.0",port=process.env.MCP_PORT||8787,ratePerMinute=Number(process.env.MCP_RATE_LIMIT_PER_MINUTE||60),rateBurst=Number(process.env.MCP_RATE_BURST||20)}={}) {
  const server=http.createServer(async(req,res)=>{
    if(req.method==="OPTIONS"){res.writeHead(204,{"access-control-allow-origin":"*","access-control-allow-methods":"POST,OPTIONS","access-control-allow-headers":"content-type,mcp-protocol-version,x-api-key"});return res.end();}
    if(req.method!=="POST" || new URL(req.url||"/","http://localhost").pathname!=="/mcp") return json(res,404,{error:"not_found"});
    if(!allowRequest(req,{perMinute:ratePerMinute,burst:rateBurst})) return json(res,429,{error:"rate_limit_exceeded",code:"MCP_RATE_LIMIT_EXCEEDED"},{"retry-after":"60"});
    try {
      const raw=await readBody(req);
      const body=JSON.parse(raw);
      if(body.jsonrpc!=="2.0") return json(res,400,rpcError(body.id??null,-32600,"Invalid JSON-RPC version"));
      const response=await handleRpc(req,body);
      return json(res,200,response,{"access-control-allow-origin":"*","mcp-protocol-version":MCP_PROTOCOL_VERSION});
    } catch(error) {
      return json(res,400,{jsonrpc:"2.0",id:null,error:{code:-32700,message:error.message}});
    }
  });
  server.requestTimeout=20000;
  server.headersTimeout=25000;
  return server.listen(Number(port),host,()=>console.log(`Din Allah MCP server listening on ${host}:${port}/mcp`));
}

if (import.meta.url===`file://${process.argv[1]}`) createMcpServer();
