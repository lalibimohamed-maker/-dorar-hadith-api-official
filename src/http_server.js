import http from 'node:http';
import { URL } from 'node:url';
import * as api from './corpus_api.js';
function json(res,status,body){res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));}
export function server(){return http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');try{
  if(req.method==='GET'&&url.pathname==='/api/v1/apis') return json(res,200,api.apiRegistry());
  if(req.method==='GET'&&url.pathname.startsWith('/api/v1/apis/')) return json(res,200,api.apiConnector(decodeURIComponent(url.pathname.slice('/api/v1/apis/'.length))));
  if(req.method==='GET'&&url.pathname==='/api/v1/quran/ayah') return json(res,200,await api.quranAyah({verseKey:url.searchParams.get('verseKey'),translationIds:url.searchParams.get('translations')?.split(',').filter(Boolean)||[],tafsirIds:url.searchParams.get('tafsirs')?.split(',').filter(Boolean)||[],language:url.searchParams.get('lang')||'en',words:url.searchParams.get('words')==='true'}));
  if(req.method==='GET'&&url.pathname==='/api/v1/quran/translations') return json(res,200,await api.quranTranslations(url.searchParams.get('lang')||undefined));
  if(req.method==='GET'&&url.pathname==='/api/v1/quran/translation') return json(res,200,await api.quranTranslation({translationKey:url.searchParams.get('key'),surah:url.searchParams.get('surah'),ayah:url.searchParams.get('ayah')||undefined}));
  if(req.method==='GET'&&url.pathname==='/api/v1/dorar/search') return json(res,200,await api.dorarSearch(url.searchParams.get('q')||''));
  if(req.method==='GET'&&url.pathname==='/api/v1/sunnah/hadiths') return json(res,200,await api.sunnahHadiths({collection:url.searchParams.get('collection')||undefined,bookNumber:url.searchParams.get('bookNumber')||undefined,chapterId:url.searchParams.get('chapterId')||undefined,hadithNumber:url.searchParams.get('hadithNumber')||undefined,limit:url.searchParams.get('limit')||undefined,page:url.searchParams.get('page')||undefined}));
  if(req.method==='GET'&&url.pathname==='/api/v1/sunnah/refs') return json(res,200,await api.sunnahHadithRefs((url.searchParams.get('refs')||'').split(',').filter(Boolean)));
  if(req.method==='GET'&&url.pathname==='/api/v1/sunnah/urns') return json(res,200,await api.sunnahHadithUrns((url.searchParams.get('urns')||'').split(',').filter(Boolean)));
  if(req.method==='GET'&&url.pathname==='/api/v1/sunnah/collections') return json(res,200,await api.sunnahCollections());
  if(req.method==='GET'&&url.pathname.startsWith('/api/v1/sunnah/collections/')) return json(res,200,await api.sunnahCollection(decodeURIComponent(url.pathname.slice('/api/v1/sunnah/collections/'.length))));
  if(req.method==='GET'&&url.pathname==='/api/v1/quran/sync') return json(res,200,await api.quranFoundationSync({resources:url.searchParams.get('resources')?.split(',').filter(Boolean)||[],syncToken:url.searchParams.get('syncToken')||null}));
  if(req.method==='GET'&&url.pathname==='/api/v1/search') return json(res,200,api.search(url.searchParams.get('q')||'',{language:url.searchParams.get('lang')||'ar',bilingual:url.searchParams.get('bilingual')==='true',comparative:url.searchParams.get('comparative')==='true'}));
  if(req.method==='GET'&&url.pathname==='/api/v1/encyclopedia/search') return json(res,200,api.encyclopediaSearch(url.searchParams.get('q')||'',{language:url.searchParams.get('lang')||'ar',verifiedOnly:url.searchParams.get('verifiedOnly')==='true'}));
  if(req.method==='GET'&&url.pathname.startsWith('/api/v1/encyclopedia/source/')) return json(res,200,api.encyclopediaSource(decodeURIComponent(url.pathname.slice('/api/v1/encyclopedia/source/'.length))));
  if(req.method==='GET'&&url.pathname.startsWith('/api/v1/encyclopedia/domain/')) return json(res,200,api.encyclopediaDomain(decodeURIComponent(url.pathname.slice('/api/v1/encyclopedia/domain/'.length))));
  if(req.method==='GET'&&url.pathname==='/api/v1/rijal/narrator') { const raw=url.searchParams.get('record'); let record; try{record=raw?JSON.parse(raw):null;}catch{record=null;} return json(res,200,api.narratorEvidence(record||{})); }
  if(req.method==='GET'&&url.pathname==='/api/v1/hadith/narrator') return json(res,200,api.hadithNarratorProfile({id:url.searchParams.get('id')||undefined,name:url.searchParams.get('name')||undefined}));
  if(req.method==='GET'&&url.pathname==='/api/v1/concept') return json(res,200,api.concept(url.searchParams.get('term')||'',url.searchParams.get('context')||'',url.searchParams.get('lang')||'ar',{comparative:url.searchParams.get('comparative')==='true'}));
  if(req.method==='GET'&&url.pathname==='/api/v1/bilingual') return json(res,200,api.bilingual(url.searchParams.get('original')||'',url.searchParams.get('translation')||'',url.searchParams.get('lang')||'en'));
  if(req.method==='GET'&&url.pathname==='/api/v1/engines/worship') return json(res,200,api.worshipLearning({topic:url.searchParams.get('topic')||undefined,question:url.searchParams.get('q')||undefined,audience:url.searchParams.get('audience')||'general',language:url.searchParams.get('lang')||'ar',mode:url.searchParams.get('mode')||'guided'}));
  if(req.method==='GET'&&url.pathname==='/api/v1/engines/transactions') return json(res,200,api.transactionLearning({topic:url.searchParams.get('topic')||undefined,question:url.searchParams.get('q')||undefined,language:url.searchParams.get('lang')||'ar'}));
  if(req.method==='GET'&&url.pathname.startsWith('/api/v1/engines/')) { const id=url.pathname.slice('/api/v1/engines/'.length); if(id) return json(res,200,api.specializedEngine(id)); }
  return json(res,404,{error:'not_found'});
}catch(error){return json(res,500,{error:'internal_error',message:error.message});}});}
