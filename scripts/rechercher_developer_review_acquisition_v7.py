#!/usr/bin/env python3
"""Content-first PDF acquisition engine for the protected Rechercher review vault.

A candidate is retained only after: real-PDF check, qpdf validation, page sanity,
identity evidence from inside the PDF (metadata and/or first pages), and global
SHA-256 uniqueness. URL-only matches are never sufficient. Duplicate candidates
are rejected and acquisition continues to later providers.
"""
import argparse, hashlib, html, json, re, subprocess, tempfile, unicodedata
from pathlib import Path
from urllib.parse import quote, urlencode, urljoin
from urllib.request import Request, urlopen

ARABIC_DIACRITICS = re.compile(r'[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]')
STOP = set('من في على عن إلى الى و أو او ثم بن ابن أبو ابي أبي ام أم هذا هذه ذلك تلك كتاب كتب جزء مجلد تحقيق شرح دار طبعة الطبعة'.split())
UA = 'DinAllah-Encyclopedia/developer-review-acquisition/7.0'
DEFAULT_DISCOVERY = [
    'books-batches/salaf-01-400h/master-discovery-additions-2026.json',
    'books-batches/salaf-01-400h/worldwide-deep-research-wave-2026-09.json',
]

def norm_url(u): return (u or '').split('#',1)[0]
def normalize_text(v):
    s=unicodedata.normalize('NFKC',v or '')
    s=ARABIC_DIACRITICS.sub('',s).replace('ـ','')
    s=s.translate(str.maketrans({'أ':'ا','إ':'ا','آ':'ا','ٱ':'ا','ى':'ي','ة':'ه','ؤ':'و','ئ':'ي'}))
    s=s.lower().replace('_',' ')
    s=re.sub(r'[^\w\u0600-\u06ff]+',' ',s,flags=re.UNICODE)
    return re.sub(r'\s+',' ',s).strip()
def tokens(v): return [t for t in normalize_text(v).split() if len(t)>=2 and t not in STOP]
def overlap(needles, hay):
    n=set(needles)
    return len(n & set(tokens(hay)))/max(1,len(n))
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
    page,_,final=page_text(source)
    return [final] if page is None else links(page,final)
def query_terms(book): return ' '.join((book.get('title') or '').split()),' '.join((book.get('author') or '').split())
def archive_urls(book):
    title,author=query_terms(book); parts=[]
    if title: parts.append(f'title:"{title}"')
    if author: parts.append(f'creator:"{author}"')
    if not parts: return []
    q=' AND '.join(parts)
    search='https://archive.org/advancedsearch.php?'+urlencode({'q':q,'fl[]':'identifier','rows':12,'page':1,'output':'json'})
    try: data=json.loads(fetch(search)[0].decode('utf-8','replace'))
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
    engines=[
        ('global:nyu_aco',aco_urls),
        ('global:wikimedia_commons',lambda b:mediawiki_pdf_urls('https://commons.wikimedia.org/w/api.php',b)),
        ('global:wikisource',lambda b:mediawiki_pdf_urls('https://ar.wikisource.org/w/api.php',b)),
        ('global:internet_archive',archive_urls),
    ]
    for source,fn in engines:
        try: out.extend((source,u) for u in fn(book))
        except Exception: continue
    return list(dict.fromkeys(out))
def catalog_sources(book):
    out=[]
    if book.get('waqfeya_url'): out.append(('waqfeya',book['waqfeya_url']))
    for key in ('source_url','url'):
        if book.get(key): out.append((key,book[key]))
    for x in book.get('sources',[]) or []:
        u=x if isinstance(x,str) else x.get('url')
        if u: out.append(('catalog-source',u))
    return out
def sha256_file(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()
def pdf_stats(path):
    q=subprocess.run(['qpdf','--check',str(path)],text=True,capture_output=True)
    if q.returncode!=0: return False,0,'qpdf_failed'
    r=subprocess.run(['pdfinfo',str(path)],text=True,capture_output=True)
    if r.returncode!=0: return False,0,'pdfinfo_failed'
    pages=0
    for line in r.stdout.splitlines():
        if line.lower().startswith('pages:'):
            try: pages=int(line.split(':',1)[1].strip())
            except ValueError: pages=0
            break
    return True,pages,r.stdout
def pdf_identity_signals(path):
    meta=''; text=''
    try:
        ok=subprocess.run(['pdfinfo',str(path)],text=True,capture_output=True,timeout=30)
        if ok.returncode==0: meta=ok.stdout
    except Exception: pass
    try:
        with tempfile.NamedTemporaryFile(suffix='.txt') as tmp:
            r=subprocess.run(['pdftotext','-f','1','-l','8','-layout',str(path),tmp.name],text=True,capture_output=True,timeout=120)
            if r.returncode==0: text=Path(tmp.name).read_text(encoding='utf-8',errors='replace')
    except Exception: pass
    return meta,text
def content_identity(book,path):
    meta,text=pdf_identity_signals(path)
    title=tokens(book.get('title','')); author=tokens(book.get('author',''))
    if not title: return False,{'reason':'missing_catalog_title'}
    title_meta=overlap(title,meta); title_text=overlap(title,text)
    author_meta=overlap(author,meta) if author else 1.0
    author_text=overlap(author,text) if author else 1.0
    title_score=max(title_meta,title_text); author_score=max(author_meta,author_text)
    title_ok=title_score >= (0.60 if len(set(title))<4 else 0.50)
    author_ok=not author or author_score>=0.50
    content_evidence=(title_text>0 or title_meta>0 or author_text>0 or author_meta>0)
    ok=title_ok and author_ok and content_evidence
    return ok,{'title_score':round(title_score,3),'title_meta':round(title_meta,3),'title_text':round(title_text,3),'author_score':round(author_score,3),'author_meta':round(author_meta,3),'author_text':round(author_text,3),'signals':'pdf_metadata_or_first_pages_only'}
def key_for(book): return (' '.join((book.get('title') or '').split()),' '.join((book.get('author') or '').split()),str(book.get('author_death_hijri') or book.get('death_hijri') or ''))
def load_discovery(root,path):
    data=json.loads(path.read_text(encoding='utf-8')); out=[]
    for e in data.get('entries',[]):
        if e.get('title'): out.append(dict(e))
    return out
def build_books(root,catalog,discovery):
    cat=json.loads((root/catalog).read_text(encoding='utf-8')); merged={key_for(b):dict(b) for b in cat.get('books',[])}; loaded=[]
    for rel in discovery:
        p=root/rel
        if not p.exists(): raise FileNotFoundError(rel)
        loaded.append(rel)
        for e in load_discovery(root,p):
            e.setdefault('author_death_hijri',e.get('death_hijri')); k=key_for(e)
            if k not in merged: merged[k]=dict(e)
            else:
                b=merged[k]
                for f in ('waqfeya_url','source_url','edition','expected_volumes'):
                    if not b.get(f) and e.get(f): b[f]=e[f]
                for s in e.get('sources',[]) or []:
                    b.setdefault('sources',[])
                    if s not in b['sources']: b['sources'].append(s)
    return cat,sorted(merged.values(),key=lambda b:(b.get('author_death_hijri') or b.get('death_hijri') or 10**9,b.get('title') or '')),loaded
def prior_sha_index(root,review_branch,manifest_path):
    if not review_branch: return {}
    try: raw=subprocess.check_output(['git','show',f'origin/{review_branch}:{manifest_path}'],text=True,stderr=subprocess.DEVNULL)
    except Exception: return {}
    try: data=json.loads(raw)
    except Exception: return {}
    out={}
    for rec in data.get('records',[]):
        rid=str(rec.get('id') or '')
        for item in rec.get('acquired',[]) or []:
            digest=item.get('sha256')
            if digest: out.setdefault(digest,set()).add(rid)
    return out
def main():
    p=argparse.ArgumentParser()
    p.add_argument('--root',required=True); p.add_argument('--catalog',default='books-batches/salaf-01-400h/catalog.json'); p.add_argument('--discovery',action='append',default=None); p.add_argument('--out',default='books-batches/salaf-01-400h/developer-review-manifest.json'); p.add_argument('--vault',default='artifacts/developer-review-vault'); p.add_argument('--review-branch',default='')
    a=p.parse_args(); root=Path(a.root).resolve(); out=root/a.out; vault=root/a.vault; vault.mkdir(parents=True,exist_ok=True)
    discovery=a.discovery if a.discovery is not None else DEFAULT_DISCOVERY; cat,books,loaded=build_books(root,a.catalog,discovery); prior=prior_sha_index(root,a.review_branch,a.out)
    used_sha={d:set(ids) for d,ids in prior.items()}; records=[]
    print(f'ACQUISITION_INPUT_BOOKS={len(books)} DISCOVERY_REGISTRIES={len(loaded)}')
    for book in books:
        bid=str(book.get('id') or hashlib.sha256('|'.join(key_for(book)).encode()).hexdigest()[:12]); target=int(book.get('expected_volumes') or 1); rec={'id':bid,'title':book.get('title'),'author':book.get('author'),'author_death_hijri':book.get('author_death_hijri',book.get('death_hijri')),'edition':book.get('edition'),'catalog_rights_status':book.get('rights_status'),'status':book.get('status'),'discovery_registries':loaded,'candidates':[],'acquired':[]}
        seen_urls=set(); acquired=[]
        ordered=catalog_sources(book)+global_urls(book)
        for source,u in ordered:
            if len(acquired)>=target: break
            if u in seen_urls: continue
            seen_urls.add(u)
            try: urls=candidate_urls(u) if not source.startswith('global:internet_archive') else [u]
            except Exception as exc: rec['candidates'].append({'source':source,'status':'source_error','error':str(exc)}); continue
            for url in urls[:60]:
                if len(acquired)>=target: break
                dest=vault/(bid+'--'+hashlib.sha256(url.encode()).hexdigest()[:20]+'.pdf')
                try:
                    print(f'[TRY] {bid} <- {source} {url}',flush=True); data,_,final=fetch(url)
                    if data[:5]!=b'%PDF-': continue
                    dest.write_bytes(data); digest=sha256_file(dest); ok,pages,detail=pdf_stats(dest)
                    item={'source':source,'url':final,'bytes':dest.stat().st_size,'sha256':digest,'pages':pages}
                    if not ok or pages<2:
                        dest.unlink(missing_ok=True); item['status']='pdf_sanity_rejected'; rec['candidates'].append(item); continue
                    ids=used_sha.get(digest,set())
                    if ids and (bid not in ids):
                        dest.unlink(missing_ok=True); item['status']='duplicate_sha256_other_book'; item['conflicts']=sorted(ids); rec['candidates'].append(item); print(f'[REJECTED-DUPLICATE-SHA] {bid} sha256={digest} conflicts={sorted(ids)}',flush=True); continue
                    good,identity=content_identity(book,dest); item['identity']=identity
                    if not good:
                        dest.unlink(missing_ok=True); item['status']='book_identity_mismatch'; rec['candidates'].append(item); print(f'[REJECTED-IDENTITY] {bid} title_score={identity.get("title_score")} author_score={identity.get("author_score")} source={source}',flush=True); continue
                    item['status']='acquired_for_review'; item['local_path']=str(dest.relative_to(root)); rec['candidates'].append(item); acquired.append(item); used_sha.setdefault(digest,set()).add(bid)
                    print(f'[DOWNLOADED+VERIFIED+IDENTITY+UNIQUE] {bid} bytes={item["bytes"]} pages={pages} sha256={digest} source={source}',flush=True)
                except Exception as exc:
                    dest.unlink(missing_ok=True); rec['candidates'].append({'source':source,'url':url,'status':'download_error','error':str(exc)})
        rec['acquired']=acquired; rec['acquired_count']=len(acquired); complete=len(acquired)==target; rec['availability']='copy-acquired' if complete else ('partial-acquisition' if acquired else 'not-acquired'); rec['acquisition_state']='acquired' if complete else ('partial' if acquired else 'global-search-no-match'); rec['rights_action']='developer-vault-encrypt' if acquired else 'none'; rec['rejected_identity_count']=sum(x.get('status')=='book_identity_mismatch' for x in rec['candidates']); records.append(rec)
    summary={'schema':'developer-review-acquisition/v7-content-first','scope':cat.get('scope'),'discovery_registries_loaded':loaded,'principle':'PDF identity is proven from PDF-internal metadata/first-pages text; URL-only evidence is never sufficient; cross-book SHA-256 duplicates are rejected and acquisition fails over to later candidates','identity_gate':{'required':True,'content_first':True,'known_author_match':True,'url_only_forbidden':True,'duplicate_sha256_forbidden':True,'page_sanity_required':True,'expected_volume_completeness_required':True},'records':records,'counts':{'books':len(records),'acquired_books':sum(r['acquisition_state']=='acquired' for r in records),'acquired_files':sum(r['acquired_count'] for r in records),'partial_books':sum(r['acquisition_state']=='partial' for r in records),'global_search_no_match':sum(r['acquisition_state']=='global-search-no-match' for r in records),'identity_rejections':sum(r['rejected_identity_count'] for r in records),'duplicate_sha_rejections':sum(sum(x.get('status')=='duplicate_sha256_other_book' for x in r['candidates']) for r in records)}}
    out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); print('ACQUIRE_COUNTS '+json.dumps(summary['counts'],ensure_ascii=False,sort_keys=True))
    return 0 if summary['counts']['acquired_books']>0 else 1
if __name__=='__main__': raise SystemExit(main())
