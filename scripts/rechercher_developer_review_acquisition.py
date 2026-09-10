#!/usr/bin/env python3
"""Acquire catalogued PDFs only after book-identity verification.

A valid PDF is not sufficient: the candidate must match the requested title and,
when known, author using normalized URL/filename/metadata/first-pages text.
Mismatches are rejected before the file is retained and acquisition fails over
to the next provider. Discovery never implies redistribution rights.
"""
import argparse, hashlib, json, re, html, unicodedata, subprocess, tempfile
from pathlib import Path
from urllib.parse import urljoin, urlencode, quote
from urllib.request import Request, urlopen

p = argparse.ArgumentParser()
p.add_argument('--root', required=True)
p.add_argument('--catalog', default='books-batches/salaf-01-400h/catalog.json')
p.add_argument('--discovery', action='append', default=None)
p.add_argument('--out', default='books-batches/salaf-01-400h/developer-review-manifest.json')
p.add_argument('--vault', default='artifacts/developer-review-vault')
a = p.parse_args()
root = Path(a.root).resolve(); catalog_path = root / a.catalog; out = root / a.out; vault = root / a.vault
UA = 'DinAllah-Encyclopedia/developer-review-acquisition/3.0'
DEFAULT_DISCOVERY = ['books-batches/salaf-01-400h/master-discovery-additions-2026.json','books-batches/salaf-01-400h/worldwide-deep-research-wave-2026-09.json']
ARABIC_DIACRITICS = re.compile(r'[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]')
STOP = set('من في على عن إلى الى و أو او ثم بن ابن أبو ابي أبي ام أم هذا هذه ذلك تلك كتاب كتب جزء مجلد تحقيق شرح دار طبعة الطبعة'.split())

def norm_url(u): return u.split('#', 1)[0]
def normalize_text(value):
    s = unicodedata.normalize('NFKC', value or '')
    s = ARABIC_DIACRITICS.sub('', s).replace('ـ', '')
    s = s.translate(str.maketrans({'أ':'ا','إ':'ا','آ':'ا','ٱ':'ا','ى':'ي','ة':'ه','ؤ':'و','ئ':'ي'}))
    s = s.lower().replace('_', ' ')
    s = re.sub(r'[^\w\u0600-\u06ff]+', ' ', s, flags=re.UNICODE)
    return re.sub(r'\s+', ' ', s).strip()
def tokens(value): return [t for t in normalize_text(value).split() if len(t) >= 2 and t not in STOP]
def fetch(u):
    req = Request(norm_url(u), headers={'User-Agent': UA})
    with urlopen(req, timeout=120) as r: return r.read(), (r.headers.get('Content-Type') or '').lower(), r.geturl()
def page_text(u):
    data, ctype, final = fetch(u)
    if 'pdf' in ctype or data[:5] == b'%PDF-': return None, ctype, final
    return data.decode('utf-8', 'replace'), ctype, final
def links(page, base):
    seen=[]
    for m in re.finditer(r'href=["\']([^"\']+)["\']', page, re.I):
        u=norm_url(urljoin(base, html.unescape(m.group(1))))
        if re.search(r'\.pdf(?:\?|$)', u, re.I) or 'archive.org/download/' in u.lower():
            if u not in seen: seen.append(u)
    return seen
def candidate_urls(source):
    page, _, final = page_text(source)
    return [final] if page is None else links(page, final)
def query_terms(book): return ' '.join((book.get('title') or '').split()), ' '.join((book.get('author') or '').split())
def archive_urls(book):
    title, author=query_terms(book); parts=[]
    if title: parts.append(f'title:"{title}"')
    if author: parts.append(f'creator:"{author}"')
    if not parts: return []
    search='https://archive.org/advancedsearch.php?'+urlencode({'q':' AND '.join(parts),'fl[]':'identifier','rows':12,'page':1,'output':'json'})
    try: data=json.loads(fetch(search)[0].decode('utf-8','replace'))
    except Exception: return []
    result=[]
    for doc in data.get('response',{}).get('docs',[]):
        ident=doc.get('identifier')
        if not ident: continue
        try: meta=json.loads(fetch('https://archive.org/metadata/'+quote(ident,safe=''))[0].decode('utf-8','replace'))
        except Exception: continue
        pdfs=[(int(f.get('size') or 0),f.get('name','')) for f in meta.get('files',[]) if f.get('name','').lower().endswith('.pdf') and not f.get('name','').lower().endswith(('_text.pdf','_scandata.pdf'))]
        for _,name in sorted(pdfs,reverse=True)[:5]: result.append('https://archive.org/download/'+quote(ident,safe='')+'/'+quote(name,safe=''))
    return result
def aco_urls(book):
    title, author=query_terms(book); q=' '.join(x for x in (title,author) if x)
    if not q: return []
    try: page,_,final=page_text('https://aco.dlib.nyu.edu/search?'+urlencode({'q':q}))
    except Exception: return []
    viewers=[]
    for m in re.finditer(r'href=["\']([^"\']*/viewer/books/[^"\']+)["\']',page or '',re.I):
        u=norm_url(urljoin(final,html.unescape(m.group(1))))
        if u not in viewers: viewers.append(u)
    result=[]
    for v in viewers[:12]:
        try: vp,_,vf=page_text(v)
        except Exception: continue
        result.extend(links(vp or '',vf))
    return list(dict.fromkeys(result))
def mediawiki_pdf_urls(api, book, namespace=6):
    title,author=query_terms(book); q=' '.join(x for x in (title,author) if x)
    if not q: return []
    params={'action':'query','generator':'search','gsrsearch':q,'gsrnamespace':namespace,'gsrlimit':10,'prop':'imageinfo','iiprop':'url','format':'json'}
    try: data=json.loads(fetch(api+'?'+urlencode(params))[0].decode('utf-8','replace'))
    except Exception: return []
    out=[]
    for item in (data.get('query',{}).get('pages',{}) or {}).values():
        for info in item.get('imageinfo',[]) or []:
            u=info.get('url')
            if u and re.search(r'\.pdf(?:$|\?)',u,re.I): out.append(u)
    return list(dict.fromkeys(out))
def global_urls(book):
    result=[]
    for source,fn in [('global:nyu_aco',aco_urls),('global:wikimedia_commons',lambda b:mediawiki_pdf_urls('https://commons.wikimedia.org/w/api.php',b)),('global:wikisource',lambda b:mediawiki_pdf_urls('https://ar.wikisource.org/w/api.php',b)),('global:internet_archive',archive_urls)]:
        try: result.extend((source,u) for u in fn(book))
        except Exception: continue
    return list(dict.fromkeys(result))
def sources(book):
    result=[]
    if book.get('waqfeya_url'): result.append(('waqfeya',book['waqfeya_url']))
    for k in ('source_url','url'):
        if book.get(k): result.append((k,book[k]))
    for x in book.get('sources',[]):
        u=x if isinstance(x,str) else x.get('url')
        if u: result.append(('catalog-source',u))
    return result
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
            r=subprocess.run(['pdftotext','-f','1','-l','6','-layout',str(path),tmp.name],text=True,capture_output=True,timeout=90)
            if r.returncode==0: chunks.append(Path(tmp.name).read_text(encoding='utf-8',errors='replace'))
    except Exception: pass
    return '\n'.join(chunks)
def identity_check(book, url, data):
    url_signal=normalize_text(url.replace('/',' ')); text_signal=normalize_text(data)
    title_tokens=tokens(book.get('title','')); author_tokens=tokens(book.get('author',''))
    if not title_tokens: return False, {'reason':'missing_catalog_title'}
    def overlap(needles,hay): return len(set(needles)&set(tokens(hay)))/max(1,len(set(needles)))
    title_score=max(overlap(title_tokens,url_signal),overlap(title_tokens,text_signal))
    author_score=1.0 if not author_tokens else max(overlap(author_tokens,url_signal),overlap(author_tokens,text_signal))
    title_ok=title_score >= (0.50 if len(title_tokens)>=4 else 0.60)
    author_ok=not author_tokens or author_score >= 0.50
    if title_ok and author_ok: return True, {'title_score':round(title_score,3),'author_score':round(author_score,3),'signals':'url_or_pdf_metadata_or_first_pages'}
    return False, {'reason':'book_identity_mismatch','title_score':round(title_score,3),'author_score':round(author_score,3),'required_title_score':0.50 if len(title_tokens)>=4 else 0.60,'required_author_score':0.50 if author_tokens else None}
def key_for(b): return (' '.join((b.get('title') or '').split()),' '.join((b.get('author') or '').split()),str(b.get('author_death_hijri') or b.get('death_hijri') or ''))
def slug(v):
    v=unicodedata.normalize('NFKD',v or ''); v=''.join(c for c in v if not unicodedata.combining(c)); return re.sub(r'[^\w\-]+','-',v,flags=re.UNICODE).strip('-_').lower()[:70] or 'work'
def stable_id(b): return slug(b.get('id') or b.get('title') or 'work')+'--'+hashlib.sha256('|'.join(key_for(b)).encode()).hexdigest()[:12]
def load_discovery(path):
    data=json.loads(path.read_text(encoding='utf-8')); out=[]
    for e in data.get('entries',[]):
        if e.get('title'): out.append({'id':e.get('id'),'title':e.get('title'),'author':e.get('author'),'author_death_hijri':e.get('author_death_hijri',e.get('death_hijri')),'rights_status':e.get('rights_status','discovery-only'),'status':e.get('status'),'note':e.get('note'),'edition':e.get('edition'),'expected_volumes':e.get('expected_volumes'),'waqfeya_url':e.get('waqfeya_url'),'source_url':e.get('source_url'),'sources':e.get('sources',[]),'discovery_registry':str(path.relative_to(root))})
    return out
def build_books():
    cat=json.loads(catalog_path.read_text(encoding='utf-8')); merged={key_for(b):dict(b) for b in cat.get('books',[])}; loaded=[]
    for rel in (a.discovery if a.discovery is not None else DEFAULT_DISCOVERY):
        path=root/rel
        if not path.exists(): raise FileNotFoundError('missing discovery registry: '+rel)
        loaded.append(str(path.relative_to(root)))
        for e in load_discovery(path):
            k=key_for(e)
            if k not in merged: e['id']=e.get('id') or stable_id(e); merged[k]=e
            else:
                b=merged[k]; b.setdefault('discovery_registries',[])
                if str(path.relative_to(root)) not in b['discovery_registries']: b['discovery_registries'].append(str(path.relative_to(root)))
                for f in ('waqfeya_url','source_url','edition','expected_volumes'):
                    if not b.get(f) and e.get(f): b[f]=e[f]
                if e.get('sources'):
                    b.setdefault('sources',[])
                    for s in e['sources']:
                        if s not in b['sources']: b['sources'].append(s)
    books=[]
    for b in merged.values(): b['id']=b.get('id') or stable_id(b); books.append(b)
    books.sort(key=lambda b:(b.get('author_death_hijri') or b.get('death_hijri') or 10**9,b.get('title') or ''))
    return cat,books,loaded
def main():
    cat,books,loaded=build_books(); vault.mkdir(parents=True,exist_ok=True); records=[]
    print(f'ACQUISITION_INPUT_BOOKS={len(books)} DISCOVERY_REGISTRIES={len(loaded)}')
    for book in books:
        rec={'id':book['id'],'title':book['title'],'author':book.get('author'),'author_death_hijri':book.get('author_death_hijri',book.get('death_hijri')),'edition':book.get('edition'),'catalog_rights_status':book.get('rights_status'),'status':book.get('status'),'discovery_registries':book.get('discovery_registries',[]),'candidates':[]}; acquired=[]; target=book.get('expected_volumes') or 1
        ordered=[('explicit:'+name,u) for name,u in sources(book)]+global_urls(book); seen=set()
        for source,u in ordered:
            if u in seen: continue
            seen.add(u)
            try: urls=candidate_urls(u) if not source.startswith('global:internet_archive') else [u]
            except Exception as e: rec['candidates'].append({'source':source,'status':'source_error','error':str(e)}); continue
            for url in urls[:60]:
                if len(acquired)>=target: break
                dest=vault/(book['id']+'--'+hashlib.sha256(url.encode()).hexdigest()[:20]+'.pdf')
                try:
                    print(f'[TRY] {book["id"]} <- {source} {url}',flush=True)
                    data,ctype,final=fetch(url)
                    if data[:5]!=b'%PDF-': rec['candidates'].append({'source':source,'url':final,'status':'not_pdf'}); continue
                    dest.write_bytes(data); ok,msg=valid(dest); item={'source':source,'url':final,'bytes':dest.stat().st_size,'sha256':sha(dest),'validation':{'ok':ok,'output':msg}}
                    if not ok: dest.unlink(missing_ok=True); item['status']='invalid_pdf'; rec['candidates'].append(item); continue
                    identity_ok,identity=identity_check(book,final,pdf_identity_text(dest)); item['identity']=identity
                    if not identity_ok:
                        dest.unlink(missing_ok=True); item['status']='book_identity_mismatch'; rec['candidates'].append(item)
                        print(f'[REJECTED-IDENTITY] {book["id"]} title_score={identity.get("title_score")} author_score={identity.get("author_score")} source={source}',flush=True); continue
                    item['status']='acquired_for_review'; item['local_path']=str(dest.relative_to(root)); rec['candidates'].append(item); acquired.append(item)
                    print(f'[DOWNLOADED+VERIFIED+IDENTITY] {book["id"]} bytes={item["bytes"]} sha256={item["sha256"]} source={source}',flush=True)
                except Exception as e:
                    dest.unlink(missing_ok=True); rec['candidates'].append({'source':source,'url':url,'status':'download_error','error':str(e)})
            if len(acquired)>=target: break
        rec['availability']='copy-acquired' if acquired else 'not-acquired'; rec['acquisition_state']='acquired' if acquired else 'global-search-no-match'; rec['acquired']=acquired; rec['acquired_count']=len(acquired); rec['rejected_identity_count']=sum(x.get('status')=='book_identity_mismatch' for x in rec['candidates']); rec['rights_action']='public-eligible' if acquired and book.get('rights_status')=='verified-redistributable' else ('developer-vault-encrypt' if acquired else 'none'); records.append(rec)
    summary={'schema':'developer-review-acquisition/v6-identity-gated','scope':cat['scope'],'discovery_registries_loaded':loaded,'principle':'catalog/discovery completeness is independent from redistribution rights; acquired copies are retained for review and never published by this acquisition step','identity_gate':{'required':True,'title_and_known_author_match':True,'validation_before_retention':True,'failover_on_mismatch':True},'global_engines':['internet_archive','nyu_aco','wikimedia_commons','wikisource'],'records':records,'counts':{'books':len(records),'acquired_books':sum(r['availability']=='copy-acquired' for r in records),'acquired_files':sum(r['acquired_count'] for r in records),'global_search_no_match':sum(r['acquisition_state']=='global-search-no-match' for r in records),'identity_rejections':sum(r['rejected_identity_count'] for r in records)}}
    out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); print('ACQUIRE_COUNTS '+json.dumps(summary['counts'],ensure_ascii=False,sort_keys=True))
if __name__=='__main__': main()
