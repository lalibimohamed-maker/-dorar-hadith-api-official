#!/usr/bin/env python3
"""Resilient Rechercher PDF acquisition engine.

Acquisition is independent from final governance/publication. A single bad book,
source, schema field, or reporting record must never discard already downloaded
PDFs or abort the remaining catalog. Every retained PDF is validated and identity
gated before it is counted as acquired. Rights never imply publication rights.
"""
import argparse, hashlib, html, json, re, subprocess, tempfile, unicodedata
from pathlib import Path
from urllib.parse import quote, urlencode, urljoin
from urllib.request import Request, urlopen

P = argparse.ArgumentParser()
P.add_argument('--root', required=True)
P.add_argument('--catalog', default='books-batches/salaf-01-400h/catalog.json')
P.add_argument('--discovery', action='append', default=None)
P.add_argument('--out', default='books-batches/salaf-01-400h/developer-review-manifest.json')
P.add_argument('--vault', default='artifacts/developer-review-vault')
P.add_argument('--review-branch', default='')
a = P.parse_args()
ROOT = Path(a.root).resolve(); CATALOG_PATH = ROOT / a.catalog; OUT = ROOT / a.out; VAULT = ROOT / a.vault
UA = 'DinAllah-Encyclopedia/rechercher-acquisition/8.0'
DEFAULT_DISCOVERY = ['books-batches/salaf-01-400h/master-discovery-additions-2026.json','books-batches/salaf-01-400h/worldwide-deep-research-wave-2026-09.json']
DIAC = re.compile(r'[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]')
STOP = set('من في على عن إلى الى و أو او ثم بن ابن أبو ابي أبي ام أم هذا هذه ذلك تلك كتاب كتب جزء مجلد تحقيق شرح دار طبعة الطبعة'.split())

def norm_url(u): return (u or '').split('#', 1)[0]
def norm(v):
    s=unicodedata.normalize('NFKC', v or ''); s=DIAC.sub('', s).replace('ـ','')
    s=s.translate(str.maketrans({'أ':'ا','إ':'ا','آ':'ا','ٱ':'ا','ى':'ي','ة':'ه','ؤ':'و','ئ':'ي'})).lower().replace('_',' ')
    return re.sub(r'\s+',' ',re.sub(r'[^\w\u0600-\u06ff]+',' ',s,flags=re.UNICODE)).strip()
def tokens(v): return [x for x in norm(v).split() if len(x)>=2 and x not in STOP]
def overlap(needles, hay):
    n=set(needles); return len(n & set(tokens(hay)))/max(1,len(n))
def fetch(u):
    req=Request(norm_url(u),headers={'User-Agent':UA})
    with urlopen(req,timeout=120) as r: return r.read(),(r.headers.get('Content-Type') or '').lower(),r.geturl()
def page_text(u):
    data,ctype,final=fetch(u)
    return (None,ctype,final) if ('pdf' in ctype or data[:5]==b'%PDF-') else (data.decode('utf-8','replace'),ctype,final)
def links(page,base):
    out=[]
    for m in re.finditer(r'href=["\']([^"\']+)["\']',page or '',re.I):
        u=norm_url(urljoin(base,html.unescape(m.group(1))))
        if re.search(r'\.pdf(?:\?|$)',u,re.I) or 'archive.org/download/' in u.lower():
            if u not in out: out.append(u)
    return out
def candidate_urls(source):
    page,_,final=page_text(source); return [final] if page is None else links(page,final)
def query_terms(book): return ' '.join((book.get('title') or '').split()),' '.join((book.get('author') or '').split())
def archive_urls(book):
    title,author=query_terms(book); parts=[]
    if title: parts.append(f'title:"{title}"')
    if author: parts.append(f'creator:"{author}"')
    if not parts: return []
    q='https://archive.org/advancedsearch.php?'+urlencode({'q':' AND '.join(parts),'fl[]':'identifier','rows':12,'page':1,'output':'json'})
    try: data=json.loads(fetch(q)[0].decode('utf-8','replace'))
    except Exception: return []
    out=[]
    for doc in data.get('response',{}).get('docs',[]):
        ident=doc.get('identifier')
        if not ident: continue
        try: meta=json.loads(fetch('https://archive.org/metadata/'+quote(ident,safe=''))[0].decode('utf-8','replace'))
        except Exception: continue
        pdfs=[(int(f.get('size') or 0),f.get('name','')) for f in meta.get('files',[]) if f.get('name','').lower().endswith('.pdf') and not f.get('name','').lower().endswith(('_text.pdf','_scandata.pdf'))]
        for _,name in sorted(pdfs,reverse=True)[:5]: out.append('https://archive.org/download/'+quote(ident,safe='')+'/'+quote(name,safe=''))
    return out
def aco_urls(book):
    title,author=query_terms(book); q=' '.join(x for x in (title,author) if x)
    if not q: return []
    try: page,_,final=page_text('https://aco.dlib.nyu.edu/search?'+urlencode({'q':q}))
    except Exception: return []
    viewers=[]
    for m in re.finditer(r'href=["\']([^"\']*/viewer/books/[^"\']+)["\']',page or '',re.I):
        u=norm_url(urljoin(final,html.unescape(m.group(1))))
        if u not in viewers: viewers.append(u)
    out=[]
    for v in viewers[:12]:
        try: vp,_,vf=page_text(v)
        except Exception: continue
        out.extend(links(vp or '',vf))
    return list(dict.fromkeys(out))
def mediawiki_pdf_urls(api,book):
    title,author=query_terms(book); q=' '.join(x for x in (title,author) if x)
    if not q: return []
    params={'action':'query','generator':'search','gsrsearch':q,'gsrnamespace':6,'gsrlimit':10,'prop':'imageinfo','iiprop':'url','format':'json'}
    try: data=json.loads(fetch(api+'?'+urlencode(params))[0].decode('utf-8','replace'))
    except Exception: return []
    out=[]
    for item in (data.get('query',{}).get('pages',{}) or {}).values():
        for info in item.get('imageinfo',[]) or []:
            u=info.get('url')
            if u and re.search(r'\.pdf(?:$|\?)',u,re.I): out.append(u)
    return list(dict.fromkeys(out))
def global_urls(book):
    out=[]
    for source,fn in [('global:nyu_aco',aco_urls),('global:wikimedia_commons',lambda b:mediawiki_pdf_urls('https://commons.wikimedia.org/w/api.php',b)),('global:wikisource',lambda b:mediawiki_pdf_urls('https://ar.wikisource.org/w/api.php',b)),('global:internet_archive',archive_urls)]:
        try: out.extend((source,u) for u in fn(book))
        except Exception as e: print(f'[ENGINE-ERROR] {source}: {e}',flush=True)
    return list(dict.fromkeys(out))
def catalog_sources(book):
    out=[]
    if book.get('waqfeya_url'): out.append(('waqfeya',book['waqfeya_url']))
    for k in ('source_url','url'):
        if book.get(k): out.append((k,book[k]))
    for x in book.get('sources',[]) or []:
        u=x if isinstance(x,str) else x.get('url')
        if u: out.append(('catalog-source',u))
    return out
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for c in iter(lambda:f.read(1024*1024),b''): h.update(c)
    return h.hexdigest()
def valid(path):
    r=subprocess.run(['qpdf','--check',str(path)],text=True,capture_output=True); return r.returncode==0,(r.stdout+r.stderr).strip()
def pdf_identity_text(path):
    chunks=[]
    try:
        r=subprocess.run(['pdfinfo',str(path)],text=True,capture_output=True,timeout=30)
        if r.returncode==0: chunks.append(r.stdout)
    except Exception: pass
    try:
        with tempfile.NamedTemporaryFile(suffix='.txt') as tmp:
            r=subprocess.run(['pdftotext','-f','1','-l','8','-layout',str(path),tmp.name],text=True,capture_output=True,timeout=120)
            if r.returncode==0: chunks.append(Path(tmp.name).read_text(encoding='utf-8',errors='replace'))
    except Exception: pass
    return '\n'.join(chunks)
def identity_check(book,url,data):
    title=tokens(book.get('title','')); author=tokens(book.get('author',''))
    if not title: return False,{'reason':'missing_catalog_title'}
    url_signal=norm(url.replace('/',' ')); text_signal=norm(data)
    title_score=max(overlap(title,url_signal),overlap(title,text_signal)); author_score=1.0 if not author else max(overlap(author,url_signal),overlap(author,text_signal))
    title_ok=title_score >= (0.50 if len(set(title))>=4 else 0.60); author_ok=not author or author_score>=0.50
    if title_ok and author_ok: return True,{'title_score':round(title_score,3),'author_score':round(author_score,3),'signals':'url_or_pdf_metadata_or_first_pages'}
    return False,{'reason':'book_identity_mismatch','title_score':round(title_score,3),'author_score':round(author_score,3)}
def key_for(b): return (' '.join((b.get('title') or '').split()),' '.join((b.get('author') or '').split()),str(b.get('author_death_hijri') or b.get('death_hijri') or ''))
def stable_id(b): return re.sub(r'[^\w\-]+','-',b.get('id') or b.get('title') or 'work',flags=re.UNICODE).strip('-_').lower()[:70]+'--'+hashlib.sha256('|'.join(key_for(b)).encode()).hexdigest()[:12]
def load_discovery(path):
    data=json.loads(path.read_text(encoding='utf-8')); return [dict(e) for e in data.get('entries',[]) if e.get('title')]
def build_books():
    cat=json.loads(CATALOG_PATH.read_text(encoding='utf-8')); merged={key_for(b):dict(b) for b in cat.get('books',[])}; loaded=[]
    for rel in (a.discovery if a.discovery is not None else DEFAULT_DISCOVERY):
        p=ROOT/rel
        if not p.exists(): print(f'[DISCOVERY-MISSING] {rel}; continuing with catalog only',flush=True); continue
        loaded.append(str(p.relative_to(ROOT)))
        try: entries=load_discovery(p)
        except Exception as e: print(f'[DISCOVERY-ERROR] {rel}: {e}',flush=True); continue
        for e in entries:
            e.setdefault('author_death_hijri',e.get('death_hijri')); k=key_for(e)
            if k not in merged: merged[k]=dict(e)
            else:
                b=merged[k]
                for f in ('waqfeya_url','source_url','edition','expected_volumes'):
                    if not b.get(f) and e.get(f): b[f]=e[f]
                for s in e.get('sources',[]) or []:
                    b.setdefault('sources',[])
                    if s not in b['sources']: b['sources'].append(s)
    books=list(merged.values())
    for b in books: b['id']=b.get('id') or stable_id(b)
    books.sort(key=lambda b:(b.get('author_death_hijri') or b.get('death_hijri') or 10**9,b.get('title') or ''))
    return cat,books,loaded
def write_manifest(cat,loaded,records):
    counts={'books':len(records),'acquired_books':sum(r.get('availability')=='copy-acquired' for r in records),'acquired_files':sum(r.get('acquired_count',0) for r in records),'global_search_no_match':sum(r.get('acquisition_state')=='global-search-no-match' for r in records),'identity_rejections':sum(r.get('rejected_identity_count',0) for r in records),'partial_books':sum(r.get('acquisition_state')=='partial' for r in records)}
    data={'schema':'developer-review-acquisition/v8-resilient','scope':cat.get('scope'),'discovery_registries_loaded':loaded,'principle':'acquisition/reporting errors are isolated; acquired PDFs remain available for the persistence boundary; rights do not imply publication','identity_gate':{'required':True,'title_and_known_author_match':True,'validation_before_retention':True,'failover_on_mismatch':True},'global_engines':['internet_archive','nyu_aco','wikimedia_commons','wikisource'],'records':records,'counts':counts}
    OUT.parent.mkdir(parents=True,exist_ok=True); OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); return data
def main():
    cat,books,loaded=build_books(); VAULT.mkdir(parents=True,exist_ok=True); records=[]
    print(f'ACQUISITION_INPUT_BOOKS={len(books)} DISCOVERY_REGISTRIES={len(loaded)}',flush=True)
    for index,book in enumerate(books,1):
        bid=str(book['id']); rec={'id':bid,'title':book.get('title'),'author':book.get('author'),'author_death_hijri':book.get('author_death_hijri',book.get('death_hijri')),'edition':book.get('edition'),'catalog_rights_status':book.get('rights_status'),'status':book.get('status'),'discovery_registries':loaded,'candidates':[],'acquired':[]}
        try:
            target=max(1,int(book.get('expected_volumes') or 1)); acquired=[]; seen=set(); ordered=catalog_sources(book)+global_urls(book)
            rec['source_count']=len(ordered); print(f'[BOOK {index}/{len(books)}] {bid} sources={len(ordered)}',flush=True)
            for source,u in ordered:
                if len(acquired)>=target or u in seen: continue
                seen.add(u)
                try: urls=candidate_urls(u) if not source.startswith('global:internet_archive') else [u]
                except Exception as e: rec['candidates'].append({'source':source,'status':'source_error','error':str(e)}); continue
                for url in urls[:60]:
                    if len(acquired)>=target: break
                    dest=VAULT/(bid+'--'+hashlib.sha256(url.encode()).hexdigest()[:20]+'.pdf')
                    try:
                        print(f'[TRY] {bid} <- {source} {url}',flush=True); data,_,final=fetch(url)
                        if data[:5]!=b'%PDF-': rec['candidates'].append({'source':source,'url':final,'status':'not_pdf'}); continue
                        total=len(data); dest.parent.mkdir(parents=True,exist_ok=True)
                        with dest.open('wb') as f:
                            for off in range(0,total,1024*1024):
                                f.write(data[off:off+1024*1024]); done=min(off+1024*1024,total); print(f'[PDF PROGRESS] {bid} {done//(1024*1024)} MB / {(total+1024*1024-1)//(1024*1024)} MB',flush=True)
                        ok,msg=valid(dest); item={'source':source,'url':final,'bytes':dest.stat().st_size,'sha256':sha(dest),'validation':{'ok':ok,'output':msg}}
                        if not ok: dest.unlink(missing_ok=True); item['status']='invalid_pdf'; rec['candidates'].append(item); continue
                        identity_ok,identity=identity_check(book,final,pdf_identity_text(dest)); item['identity']=identity
                        if not identity_ok:
                            dest.unlink(missing_ok=True); item['status']='book_identity_mismatch'; rec['candidates'].append(item); print(f'[REJECTED-IDENTITY] {bid} title_score={identity.get("title_score")} author_score={identity.get("author_score")}',flush=True); continue
                        item['status']='acquired_for_review'; item['local_path']=str(dest.relative_to(ROOT)); rec['candidates'].append(item); acquired.append(item); print(f'[PDF DONE] {bid} bytes={item["bytes"]} sha256={item["sha256"]} source={source}',flush=True)
                    except Exception as e:
                        dest.unlink(missing_ok=True); rec['candidates'].append({'source':source,'url':url,'status':'download_error','error':str(e)})
            rec['availability']='copy-acquired' if acquired else 'not-acquired'; rec['acquisition_state']='acquired' if len(acquired)>=target else ('partial' if acquired else 'global-search-no-match'); rec['acquired']=acquired; rec['acquired_count']=len(acquired); rec['rejected_identity_count']=sum(x.get('status')=='book_identity_mismatch' for x in rec['candidates']); rec['rights_action']='public-eligible' if acquired and book.get('rights_status')=='verified-redistributable' else ('developer-vault-encrypt' if acquired else 'none')
        except Exception as e:
            rec['availability']='not-acquired' if not rec['acquired'] else 'copy-acquired'; rec['acquisition_state']='book-error'; rec['acquired_count']=len(rec['acquired']); rec['fatal_error']=str(e); print(f'[BOOK-ERROR] {bid}: {e}',flush=True)
        records.append(rec); write_manifest(cat,loaded,records); print('ACQUIRE_PROGRESS '+json.dumps({'completed_books':index,'total_books':len(books),'acquired_files':sum(r.get('acquired_count',0) for r in records)},ensure_ascii=False),flush=True)
    summary=write_manifest(cat,loaded,records); print('ACQUIRE_COUNTS '+json.dumps(summary['counts'],ensure_ascii=False,sort_keys=True))
if __name__=='__main__': main()
