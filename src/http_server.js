import http from 'node:http';
import { URL } from 'node:url';
import * as api from './corpus_api.js';
function json(res,status,body){res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));}
export function server(){return http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');try{
  if(req.method==='GET'&&url.pathname==='/api/v1/search') return json(res,200,api.search(url.searchParams.get('q')||'',{language:url.searchParams.get('lang')||'ar',bilingual:url.searchParams.get('bilingual')==='true',comparative:url.searchParams.get('comparative')==='true'}));
  if(req.method==='GET'&&url.pathname==='/api/v1/concept') return json(res,200,api.concept(url.searchParams.get('term')||'',url.searchParams.get('context')||'',url.searchParams.get('lang')||'ar',{comparative:url.searchParams.get('comparative')==='true'}));
  if(req.method==='GET'&&url.pathname==='/api/v1/bilingual') return json(res,200,api.bilingual(url.searchParams.get('original')||'',url.searchParams.get('translation')||'',url.searchParams.get('lang')||'en'));
  if(req.method==='GET'&&url.pathname==='/api/v1/engines/worship') return json(res,200,api.worshipLearning({topic:url.searchParams.get('topic')||undefined,question:url.searchParams.get('q')||undefined,audience:url.searchParams.get('audience')||'general',language:url.searchParams.get('lang')||'ar',mode:url.searchParams.get('mode')||'guided'}));
  if(req.method==='GET'&&url.pathname==='/api/v1/engines/transactions') return json(res,200,api.transactionLearning({topic:url.searchParams.get('topic')||undefined,question:url.searchParams.get('q')||undefined,language:url.searchParams.get('lang')||'ar'}));
  if(req.method==='GET'&&url.pathname==='/api/v1/engines/:id') return json(res,200,api.specializedEngine(url.pathname.split('/').pop()));
  return json(res,404,{error:'not_found'});
}catch(error){return json(res,500,{error:'internal_error',message:error.message});}});}
