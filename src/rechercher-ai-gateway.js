import http from "node:http";
import { verifyAgentAnswer } from "./rechercher-omega-answer-verifier.js";

const PORT = Number(process.env.AI_GATEWAY_PORT || 8790);
const UPSTREAM = process.env.DEEN_ALLAH_API_BASE || "http://127.0.0.1:3000";
const MAX_BODY = 64 * 1024;
const MAX_LIMIT = 100;
const buckets = new Map();

function bucketKey(req){return String(req.headers["x-forwarded-for"]||req.socket.remoteAddress||"unknown").split(",")[0].trim();}
function allow(req,{perMinute=Number(process.env.AI_GATEWAY_RATE_PER_MINUTE||60),burst=Number(process.env.AI_GATEWAY_BURST||20)}={}){
  const now=Date.now(), key=bucketKey(req);
  const b=buckets.get(key)||{tokens:burst,updated:now};
  b.tokens=Math.min(burst,b.tokens+((now-b.updated)/60000)*perMinute); b.updated=now;
  if(b.tokens<1){buckets.set(key,b);return false;} b.tokens-=1;buckets.set(key,b);
  if(buckets.size>10000) for(const [k,v] of buckets) if(now-v.updated>120000)buckets.delete(k);
  return true;
}
function encodeCursor(payload){
  return Buffer.from(JSON.stringify(payload),"utf8").toString("base64url");
}
function decodeCursor(cursor){
  if(!cursor) return {offset:0,q:null};
  try{
    const value=JSON.parse(Buffer.from(String(cursor),"base64url").toString("utf8"));
    if(!Number.isInteger(value.offset)||value.offset<0||value.offset>1000000) throw new Error("invalid offset");
    return {offset:value.offset,q:value.q==null?null:String(value.q)};
  }catch{ throw new Error("INVALID_CURSOR: cursor is invalid"); }
}
function paginateSearch(data,{q,cursor,limit}){
  const items=Array.isArray(data?.sourceMatches)?data.sourceMatches:[];
  const upstreamPagination=data?.pagination;
  if(upstreamPagination && Object.prototype.hasOwnProperty.call(upstreamPagination,"next_cursor")){
    return {...data,pagination:{...upstreamPagination,limit,cursor:cursor??upstreamPagination.cursor??null,total:upstreamPagination.total??items.length,next_cursor:upstreamPagination.next_cursor??null}};
  }
  const page=decodeCursor(cursor);
  if(page.q!==null&&page.q!==q) throw new Error("INVALID_CURSOR: cursor does not belong to this query");
  const start=page.offset;
  const end=Math.min(items.length,start+limit);
  const next=end<items.length?encodeCursor({q,offset:end}):null;
  return {...data,sourceMatches:items.slice(start,end),pagination:{limit,cursor:cursor||null,next_cursor:next,total:items.length}};
}

function errorBody(code,message,details=null){return {error:{code,message,details}};}
function send(res,status,payload,extra={}){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff",...extra});res.end(JSON.stringify(payload));}
function readJson(req){return new Promise((resolve,reject)=>{let n=0,c=[];req.on("data",x=>{n+=x.length;if(n>MAX_BODY){reject(new Error("body too large"));req.destroy();return;}c.push(x)});req.on("end",()=>resolve(Buffer.concat(c).toString("utf8")));req.on("error",reject);});}
async function upstream(path,req){
  const u=new URL(UPSTREAM); u.pathname=path; u.search=new URL(req.url||"/","http://local").search;
  const h={"accept":"application/json"}; if(process.env.DEEN_ALLAH_API_KEY)h["x-api-key"]=process.env.DEEN_ALLAH_API_KEY;
  const r=await fetch(u,{headers:h,signal:AbortSignal.timeout(15000)}); const t=await r.text(); let data; try{data=JSON.parse(t)}catch{data={raw:t}};
  if(!r.ok){const e=new Error("upstream request failed");e.status=r.status;e.data=data;throw e;} return data;
}
export function envelope(data,{cursor=null,limit=20}={}){const next_cursor=data?.pagination?.next_cursor??data?.next_cursor??null;return {schema_version:"1.0.0",data,meta:{limit,cursor,next_cursor,source_of_truth:"Din Allah API",generated_text_is_evidence:false}};}
export function createAiGateway({host="0.0.0.0",port=PORT,ratePerMinute=Number(process.env.AI_GATEWAY_RATE_PER_MINUTE||60),rateBurst=Number(process.env.AI_GATEWAY_BURST||20)}={}){
  return http.createServer(async(req,res)=>{
    if(req.method==="OPTIONS"){res.writeHead(204,{"access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"content-type,x-api-key"});return res.end();}
    if(req.method!=="GET"&&req.method!=="POST")return send(res,405,errorBody("METHOD_NOT_ALLOWED","Only GET/POST are supported."));
    if(!allow(req,{perMinute:ratePerMinute,burst:rateBurst}))return send(res,429,errorBody("RATE_LIMIT_EXCEEDED","AI gateway rate limit exceeded."),{"retry-after":"60"});
    try{
      const url=new URL(req.url||"/","http://local");
      if(url.pathname==="/api/v1/agents/health"){return send(res,200,envelope({status:"ok",mcp:"/mcp"}));}
      if(url.pathname==="/api/v1/agents/search"){
        const q=url.searchParams.get("q"); if(!q||q.length>300)return send(res,400,errorBody("INVALID_QUERY","q is required and must be <=300 characters."));
        const limit=Math.min(MAX_LIMIT,Math.max(1,Number(url.searchParams.get("limit")||20)));
        const raw=await upstream("/api/v1/search",req); const data=paginateSearch(raw,{q,cursor:url.searchParams.get("cursor"),limit}); return send(res,200,envelope(data,{cursor:data.pagination.cursor,limit}));
      }
      if(url.pathname==="/api/v1/agents/concept"){if(!url.searchParams.get("term"))return send(res,400,errorBody("INVALID_TERM","term is required."));const data=await upstream("/api/v1/concept",req);return send(res,200,envelope(data));}
      if(url.pathname==="/api/v1/agents/quran"){if(!url.searchParams.get("verse"))return send(res,400,errorBody("INVALID_VERSE","verse is required."));const data=await upstream("/api/v1/quran/ayah",req);return send(res,200,envelope(data));}
      if(url.pathname==="/api/v1/agents/verify" && req.method==="POST"){
        const body=JSON.parse(await readJson(req));
        const result=verifyAgentAnswer(body);
        return send(res,result.verified?200:422,envelope(result));
      }
      return send(res,404,errorBody("NOT_FOUND","Agent endpoint not found."));
    }catch(e){if(String(e.message).startsWith("INVALID_CURSOR"))return send(res,400,errorBody("INVALID_CURSOR",e.message));return send(res,e.status===429?429:502,errorBody("UPSTREAM_ERROR",e.message,e.data||null));}
  }).listen(Number(port),host,()=>console.log(`Din Allah AI gateway listening on ${host}:${port}`));
}
if(import.meta.url===`file://${process.argv[1]}`)createAiGateway();
