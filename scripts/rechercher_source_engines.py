#!/usr/bin/env python3
"""Build a conservative multi-engine source overlay.

A catalogued source page is not itself a PDF candidate. This resolver now
follows catalogued source pages (including Waqfeya) and extracts direct PDF
links, while keeping identity/edition evidence separate from redistribution
rights. Rights are never inferred from discovery alone.
"""
import argparse,json,re,unicodedata,time
from pathlib import Path
from urllib.parse import quote,urlencode,urljoin
from urllib.request import Request,urlopen

UA='DinAllah-Encyclopedia/source-engines/3.0'
DEFAULT_DISCOVERY=['books-batches/salaf-01-400h/master-discovery-additions-2026.json','books-batches/salaf-01-400h/worldwide-deep-research-wave-2026-09.json']
ENGINE_ROOTS={'waqfeya':'https://waqfeya.net/','internet_archive':'https://archive.org/','openlibrary':'https://openlibrary.org/','library_of_congress':'https://www.loc.gov/','google_books':'https://www.googleapis.com/books/v1/volumes?q=Islam','crossref':'https://api.crossref.org/works?rows=0'}

def get(url,timeout=30):
    r=urlopen(Request(url,headers={'User-Agent':UA}),timeout=timeout); return r.read(),r.geturl(),(r.headers.get('Content-Type') or '').lower()
def norm(s):
    s=unicodedata.normalize('NFKC',s or '').lower(); s=re.sub(r'[\u064B-\u065F\u0670]','',s); return re.sub(r'[^\w]+',' ',s,flags=re.UNICODE).strip()
def ratio(a,b):
    A=set(norm(a).split()); B=set(norm(b).split()); return len(A&B)/max(1,min(len(A),len(B))) if A and B else 0.0
def page_pdf_links(url):
    try:data,final,ctype=get(url)
    except Exception:return []
    if 'pdf' in ctype or data[:5]==b'%PDF-': return [{'url':final,'engine':'catalogued-source','match':1.0,'source_page':url}]
    text=data.decode('utf-8','replace'); out=[]
    for m in re.finditer(r'href=["\']([^"\']+)["\']',text,re.I):
        u=urljoin(final,m.group(1))
        if re.search(r'\.pdf(?:$|[?#])',u,re.I) or 'archive.org/download/' in u.lower():
            if u not in [x['url'] for x in out]: out.append({'url':u,'engine':'catalogued-source','match':1.0,'source_page':url})
    return out[:20]
def ia_pdf(identifier):
    try:d=json.loads(get('https://archive.org/metadata/'+quote(identifier,safe=''))[0].decode('utf-8'))
    except Exception:return []
    out=[]
    for f in d.get('files',[]):
        n=f.get('name','')
        if n.lower().endswith('.pdf') and not n.lower().endswith(('_text.pdf','_scandata.pdf')):
            out.append({'url':'https://archive.org/download/'+quote(identifier,safe='')+'/'+quote(n,safe=''),'identifier':identifier,'name':n})
    return out[:5]
def archive_search(title,author):
    q=' AND '.join(x for x in [f'title:"{title}"' if title else '',f'creator:"{author}"' if author else ''] if x)
    if not q:return []
    try:d=json.loads(get('https://archive.org/advancedsearch.php?'+urlencode({'q':q,'fl[]':['identifier','title','creator'],'rows':12,'output':'json'}))[0].decode('utf-8'))
    except Exception:return []
    out=[]
    for x in d.get('response',{}).get('docs',[]):
        creator=' '.join(x.get('creator',[]) if isinstance(x.get('creator'),list) else [x.get('creator','')]); ts=ratio(title,x.get('title','')); as_=ratio(author,creator) if author else 1
        if ts>=.80 and as_>=.65:
            out += [{**p,'match':round((ts+as_)/2,3),'engine':'internet_archive'} for p in ia_pdf(x['identifier'])]
    return sorted(out,key=lambda x:x.get('match',0),reverse=True)
def openlibrary(title,author):
    try:d=json.loads(get('https://openlibrary.org/search.json?'+urlencode({'q':' '.join(x for x in [title,author] if x),'fields':'title,author_name,ia,edition_key,publish_year','limit':10}))[0].decode('utf-8'))
    except Exception:return []
    out=[]
    for x in d.get('docs',[]):
        ts=ratio(title,x.get('title','')); names=x.get('author_name',[]) or []; as_=max([ratio(author,n) for n in names] or [0]) if author else 1
        if ts>=.80 and as_>=.65:
            for ident in x.get('ia',[])[:5]: out += [{**p,'match':round((ts+as_)/2,3),'engine':'openlibrary'} for p in ia_pdf(ident)]
    return sorted(out,key=lambda x:x.get('match',0),reverse=True)
def loc(title,author):
    try:d=json.loads(get('https://www.loc.gov/search/?'+urlencode({'q':' '.join(x for x in [title,author] if x),'fo':'json','c':10}))[0].decode('utf-8'))
    except Exception:return []
    return [{'url':r.get('id',''),'title':r.get('title',''),'match':round(ratio(title,r.get('title','')),3),'format':r.get('original_format'),'date':r.get('date')} for r in d.get('results',[]) if ratio(title,r.get('title',''))>=.65][:10]
def google(title,author):
    try:d=json.loads(get('https://www.googleapis.com/books/v1/volumes?'+urlencode({'q':'intitle:'+title+(' inauthor:'+author if author else ''),'maxResults':10,'projection':'full'}))[0].decode('utf-8'))
    except Exception:return []
    out=[]
    for x in d.get('items',[]):
        v=x.get('volumeInfo',{}); ts=ratio(title,v.get('title','')); names=v.get('authors',[]) or []; as_=max([ratio(author,n) for n in names] or [0]) if author else 1
        if ts>=.75 and as_>=.60: out.append({'id':x.get('id'),'title':v.get('title'),'authors':names,'publisher':v.get('publisher'),'publishedDate':v.get('publishedDate'),'access':x.get('accessInfo',{}),'match':round((ts+as_)/2,3)})
    return sorted(out,key=lambda x:x['match'],reverse=True)[:10]
def crossref(title,author):
    try:d=json.loads(get('https://api.crossref.org/works?'+urlencode({'query.title':title,'query.author':author,'rows':10}))[0].decode('utf-8'))
    except Exception:return []
    out=[]
    for x in d.get('message',{}).get('items',[]):
        ts=max([ratio(title,t) for t in x.get('title',[]) or ['']]); names=x.get('author',[]) or []; full=[' '.join([n.get('given',''),n.get('family','')]) for n in names]; as_=max([ratio(author,n) for n in full] or [0]) if author else 1
        if x.get('DOI') and ts>=.65 and as_>=.50: out.append({'DOI':x['DOI'],'title':(x.get('title') or [''])[0],'publisher':x.get('publisher'),'license':x.get('license',[]),'link':x.get('link',[]),'match':round((ts+as_)/2,3)})
    return sorted(out,key=lambda x:x['match'],reverse=True)[:10]
def entries(root,rels):
    out=[]
    for rel in rels:
        p=root/rel
        if p.exists(): out += [e for e in json.loads(p.read_text(encoding='utf-8')).get('entries',[]) if e.get('title')]
    return out
def health():
    out={}
    for name,url in ENGINE_ROOTS.items():
        t=time.monotonic()
        try:r=urlopen(Request(url,headers={'User-Agent':UA}),timeout=12); r.read(64); out[name]={'status':'up','http':r.status,'latency_ms':round((time.monotonic()-t)*1000,1)}
        except Exception as e:out[name]={'status':'down','error':type(e).__name__,'latency_ms':round((time.monotonic()-t)*1000,1)}
    return out
def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--root',required=True); ap.add_argument('--out',default='books-batches/salaf-01-400h/engine-source-overlay.json'); ap.add_argument('--discovery',action='append',default=None); a=ap.parse_args(); root=Path(a.root).resolve(); rels=a.discovery or DEFAULT_DISCOVERY; records=[]
    for b in entries(root,rels):
        title=b.get('title',''); author=b.get('author',''); candidates=[]; evidence={}; pages=[]
        for u in [b.get('waqfeya_url'),b.get('source_url'),b.get('url')]+[x if isinstance(x,str) else x.get('url') for x in b.get('sources',[])]:
            if not u: continue
            if re.search(r'\.pdf(?:$|[?#])',u,re.I): candidates.append({'url':u,'engine':'catalogued-source','match':1.0})
            elif u not in pages: pages.append(u)
        for u in pages:
            found=page_pdf_links(u); candidates += found
            if found: evidence.setdefault('catalogued_pages',[]).append({'page':u,'pdf_candidates':len(found)})
        try:candidates += archive_search(title,author); evidence['internet_archive']={'searched':True}
        except Exception as e:evidence['internet_archive']={'error':type(e).__name__}
        try:candidates += openlibrary(title,author); evidence['openlibrary']={'searched':True}
        except Exception as e:evidence['openlibrary']={'error':type(e).__name__}
        try:evidence['library_of_congress']={'results':loc(title,author)}
        except Exception as e:evidence['library_of_congress']={'error':type(e).__name__}
        try:evidence['google_books']={'results':google(title,author)}
        except Exception as e:evidence['google_books']={'error':type(e).__name__}
        try:evidence['crossref']={'results':crossref(title,author)}
        except Exception as e:evidence['crossref']={'error':type(e).__name__}
        seen=[]
        for c in sorted(candidates,key=lambda x:x.get('match',0),reverse=True):
            if c.get('url') and c['url'] not in [x['url'] for x in seen] and c.get('match',0)>=.65: seen.append(c)
        records.append({'id':b.get('id'),'title':title,'author':author,'author_death_hijri':b.get('author_death_hijri',b.get('death_hijri')),'edition':b.get('edition'),'expected_volumes':b.get('expected_volumes'),'rights_status':b.get('rights_status','discovery-only'),'source_url':seen[0]['url'] if seen else None,'sources':seen[:10],'source_pages':pages[:20],'note':'ENGINE_EVIDENCE '+json.dumps(evidence,ensure_ascii=False,separators=(',',':'))})
    out=root/a.out; out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps({'schema':'developer-review-acquisition/engine-overlay/v3','scope':'1-400H','engine_health':health(),'entries':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); print(json.dumps({'entries':len(records),'concrete_pdf_candidates':sum(bool(x.get('source_url')) for x in records)},ensure_ascii=False))
if __name__=='__main__': main()
