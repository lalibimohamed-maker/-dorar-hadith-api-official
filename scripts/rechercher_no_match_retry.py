#!/usr/bin/env python3
"""Deep Worldwide acquisition for unresolved PDF gaps.

Discovery is deliberately broader than retrying saved candidates.  It queries
public bibliographic/digital-library APIs and Arabic indexes, extracts actual
file candidates, then accepts a copy only after a real %PDF- signature,
qpdf --check, and SHA-256.  Discovery metadata is never treated as an
acquisition.  Rights/publication remains a separate gate.
"""
import argparse, hashlib, html, json, re, subprocess
from pathlib import Path
from urllib.parse import quote, urlencode, urljoin
from urllib.request import Request, urlopen

UA='DinAllah-Encyclopedia/rechercher-deep-worldwide/3.0'
TIMEOUT=90
ENGINES=(
    'saved_sources','internet_archive','open_library','library_of_congress',
    'google_books','crossref','openiti_kitab','arabic_indexes',
    'wikimedia_commons','wikisource',
)


def fetch(url):
    req=Request(url,headers={'User-Agent':UA,'Accept':'application/json,text/html,application/xhtml+xml,application/pdf,*/*'})
    with urlopen(req,timeout=TIMEOUT) as r:
        return r.read(),(r.headers.get('Content-Type') or '').lower(),r.geturl()


def get_json(url):
    data,_,_=fetch(url)
    return json.loads(data.decode('utf-8','replace'))


def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for c in iter(lambda:f.read(1024*1024),b''): h.update(c)
    return h.hexdigest()


def valid(path):
    if path.read_bytes()[:5] != b'%PDF-':
        return False,'invalid_pdf_signature'
    r=subprocess.run(['qpdf','--check',str(path)],text=True,capture_output=True)
    msg=(r.stdout+r.stderr).strip()
    if r.returncode != 0:
        return False,msg or 'qpdf_check_failed'
    # The acquisition policy treats qpdf warnings as invalid, even when qpdf
    # exits zero, because a warning can indicate a damaged source scan.
    if re.search(r'warning|error',msg,re.I):
        return False,msg
    return True,msg


def norm(s): return ' '.join(str(s or '').split()).strip()

def terms(book): return [x for x in (norm(book.get('title')),norm(book.get('author'))) if x]

def query_variants(book):
    title=norm(book.get('title')); author=norm(book.get('author'))
    out=[]
    if title and author: out += [f'{title} {author}', f'"{title}" {author}']
    if title: out += [title]
    if author: out += [author]
    return list(dict.fromkeys(x for x in out if x))


def archive_candidates(book):
    title=norm(book.get('title')); author=norm(book.get('author')); queries=[]
    if title and author: queries.append(f'title:"{title}" AND creator:"{author}"')
    if title: queries.append(f'title:"{title}"')
    if author: queries.append(f'creator:"{author}"')
    out=[]
    for q in dict.fromkeys(queries):
        try: data=get_json('https://archive.org/advancedsearch.php?'+urlencode({'q':q,'fl[]':'identifier','rows':20,'page':1,'output':'json'}))
        except Exception: continue
        for doc in data.get('response',{}).get('docs',[]):
            ident=doc.get('identifier')
            if not ident: continue
            try: meta=get_json('https://archive.org/metadata/'+quote(ident,safe=''))
            except Exception: continue
            files=[]
            for f in meta.get('files',[]):
                n=f.get('name','')
                if n.lower().endswith('.pdf') and not re.search(r'_(text|scandata)\.pdf$',n,re.I):
                    files.append((int(f.get('size') or 0),n))
            for _,n in sorted(files,reverse=True)[:8]:
                out.append('https://archive.org/download/'+quote(ident,safe='')+'/'+quote(n,safe=''))
    return list(dict.fromkeys(out))


def open_library_candidates(book):
    out=[]
    for q in query_variants(book)[:4]:
        try:
            data=get_json('https://openlibrary.org/search.json?'+urlencode({'q':q,'fields':'*,availability','limit':20,'lang':'ara'}))
        except Exception: continue
        for d in data.get('docs',[]):
            for ident in d.get('ia',[]) or []:
                if ident: out.append('https://archive.org/download/'+quote(ident,safe=''))
    return list(dict.fromkeys(out))


def loc_candidates(book):
    out=[]
    for q in query_variants(book)[:3]:
        try: data=get_json('https://www.loc.gov/books/?'+urlencode({'q':q,'fo':'json','c':20}))
        except Exception: continue
        for item in data.get('results',[]) or []:
            item_url=item.get('id')
            if item_url: out.append(item_url)
            for r in item.get('resources',[]) or []:
                for k in ('url','pdf','file'):
                    if r.get(k): out.append(r[k])
                for f in r.get('files',[]) or []:
                    if isinstance(f,str): out.append(f)
                    elif isinstance(f,dict) and f.get('url'): out.append(f['url'])
    return list(dict.fromkeys(x for x in out if isinstance(x,str)))


def google_books_candidates(book):
    out=[]
    for q in query_variants(book)[:3]:
        try: data=get_json('https://www.googleapis.com/books/v1/volumes?'+urlencode({'q':q,'maxResults':20,'printType':'books'}))
        except Exception: continue
        for item in data.get('items',[]) or []:
            vi=item.get('volumeInfo',{}) or {}; acc=item.get('accessInfo',{}) or {}
            for k in ('webReaderLink','infoLink','canonicalVolumeLink'):
                if vi.get(k): out.append(vi[k])
            for k in ('pdf','epub'):
                obj=acc.get(k) or {}
                if obj.get('downloadLink'): out.append(obj['downloadLink'])
    return list(dict.fromkeys(out))


def crossref_candidates(book):
    out=[]
    for q in query_variants(book)[:2]:
        try: data=get_json('https://api.crossref.org/works?'+urlencode({'query.bibliographic':q,'rows':5}))
        except Exception: continue
        for item in data.get('message',{}).get('items',[]) or []:
            for link in item.get('link',[]) or []:
                if link.get('URL'): out.append(link['URL'])
            if item.get('URL'): out.append(item['URL'])
    return list(dict.fromkeys(out))


def openiti_kitab_candidates(book):
    """Use OpenITI/KITAB GitHub/search surfaces as discovery, not as rights proof."""
    out=[]
    title=norm(book.get('title')); author=norm(book.get('author'))
    q=quote(' '.join(x for x in (title,author) if x))
    # OpenITI GitHub search URLs are useful discovery pages; direct repository
    # files are inspected later by page_pdf_candidates if they expose a PDF.
    if q:
        out += [
            'https://github.com/OpenITI/RELEASE/tree/master/'+q,
            'https://www.google.com/search?q='+quote('site:kitab-project.org '+title),
        ]
    return list(dict.fromkeys(out))


def arabic_index_candidates(book):
    out=[]
    title=norm(book.get('title'))
    if not title: return out
    # Public Arabic heritage indexes are discovery surfaces.  The downloader
    # only accepts a resulting URL after extracting and validating a real PDF.
    queries=[
        'https://waqfeya.net/search?'+urlencode({'q':title}),
        'https://www.almeshkat.net/search.php?'+urlencode({'q':title}),
        'https://arabicpdfs.com/?s='+quote(title),
        'https://altafser.com/?s='+quote(title),
    ]
    return queries


def mediawiki_candidates(api,book):
    q=' '.join(terms(book)); out=[]
    if not q: return out
    variants=query_variants(book)[:3]
    for query in variants:
        params={'action':'query','generator':'search','gsrsearch':query,'gsrnamespace':6,'gsrlimit':50,'prop':'imageinfo','iiprop':'url','format':'json'}
        try: data=get_json(api+'?'+urlencode(params))
        except Exception: continue
        for page in (data.get('query',{}).get('pages',{}) or {}).values():
            for info in page.get('imageinfo',[]) or []:
                u=info.get('url')
                if u: out.append(u)
    return list(dict.fromkeys(out))


def page_pdf_candidates(url):
    try: data,ctype,final=fetch(url)
    except Exception: return []
    if data[:5]==b'%PDF-': return [final]
    if 'application/pdf' in ctype and data[:5]==b'%PDF-': return [final]
    text=data.decode('utf-8','replace'); out=[]
    # HTML attributes plus common JSON-embedded direct file URLs.
    patterns=[r'href=["\']([^"\']+)["\']',r'"(?:download|pdf|file|url)"\s*:\s*"([^"]+\.pdf(?:\?[^"\\]*)?)"']
    for pattern in patterns:
        for m in re.finditer(pattern,text,re.I):
            u=urljoin(final,html.unescape(m.group(1)).replace('\\/','/'))
            if re.search(r'\.pdf(?:\?|$)',u,re.I) and not re.search(r'\.pdf\.enc(?:\?|$)',u,re.I): out.append(u)
    # Known archive download pages may omit .pdf from the landing URL.
    if 'archive.org/details/' in final:
        ident=final.rstrip('/').split('/')[-1]
        try:
            meta=get_json('https://archive.org/metadata/'+quote(ident,safe=''))
            for f in meta.get('files',[]):
                n=f.get('name','')
                if n.lower().endswith('.pdf') and not re.search(r'_(text|scandata)\.pdf$',n,re.I):
                    out.append('https://archive.org/download/'+quote(ident,safe='')+'/'+quote(n,safe=''))
        except Exception: pass
    return list(dict.fromkeys(out))


def saved_source_candidates(rec):
    out=[]
    for key in ('source_urls','saved_sources','discovery_sources','sources'):
        value=rec.get(key) or []
        if isinstance(value,str): value=[value]
        for item in value:
            if isinstance(item,str): out.append(item)
            elif isinstance(item,dict):
                for k in ('url','download_url','pdf_url','source_url'):
                    if item.get(k): out.append(item[k]); break
    for item in rec.get('candidates') or []:
        if isinstance(item,dict) and item.get('url'): out.append(item['url'])
    return list(dict.fromkeys(u for u in out if isinstance(u,str) and u.startswith(('http://','https://'))))


def candidates(rec):
    book=rec; out=[('saved_sources',u) for u in saved_source_candidates(rec)]
    funcs=[
        ('internet_archive',archive_candidates),('open_library',open_library_candidates),
        ('library_of_congress',loc_candidates),('google_books',google_books_candidates),
        ('crossref',crossref_candidates),('openiti_kitab',openiti_kitab_candidates),
        ('arabic_indexes',arabic_index_candidates),
        ('wikimedia_commons',lambda b:mediawiki_candidates('https://commons.wikimedia.org/w/api.php',b)),
        ('wikisource',lambda b:mediawiki_candidates('https://ar.wikisource.org/w/api.php',b)),
    ]
    for engine,fn in funcs:
        try:
            for u in fn(book): out.append((engine,u))
        except Exception: continue
    return list(dict.fromkeys(out))


def main():
    p=argparse.ArgumentParser(); p.add_argument('--manifest',required=True); p.add_argument('--vault',required=True); p.add_argument('--report',required=True); p.add_argument('--max-books',type=int,default=0)
    a=p.parse_args(); mp=Path(a.manifest); vault=Path(a.vault); report=Path(a.report)
    data=json.loads(mp.read_text(encoding='utf-8')); records=data.get('records',[])
    gaps=[r for r in records if r.get('acquisition_state')=='global-search-no-match']
    if a.max_books: gaps=gaps[:a.max_books]
    stats={'schema':'rechercher-deep-worldwide/v3','input_gaps':len(gaps),'new_acquired_books':0,'new_acquired_files':0,'invalid_candidates':0,'errors':0,'source_attempts':{},'gaps':[]}
    for rec in gaps:
        gap={'id':rec.get('id'),'title':rec.get('title'),'author':rec.get('author'),'attempts':[],'result':'no-match'}
        acquired=list(rec.get('acquired') or []); found=[]; seen_urls=set()
        for engine,url in candidates(rec):
            stats['source_attempts'][engine]=stats['source_attempts'].get(engine,0)+1
            if len(acquired)+len(found)>=1: break
            if url in seen_urls: continue
            seen_urls.add(url); attempt={'engine':engine,'url':url,'result':'no-pdf'}
            try:
                pdf_urls=page_pdf_candidates(url)
                if not pdf_urls: attempt['result']='no-pdf'
                for pdf in pdf_urls[:12]:
                    if len(acquired)+len(found)>=1: break
                    d=vault/(rec['id']+'--deep-'+hashlib.sha256(pdf.encode()).hexdigest()[:20]+'.pdf')
                    raw,ctype,final=fetch(pdf); d.write_bytes(raw)
                    if raw[:5] != b'%PDF-':
                        stats['invalid_candidates']+=1; attempt={'engine':engine,'url':final,'result':'invalid-pdf','validation':'invalid_pdf_signature','content_type':ctype}; d.unlink(missing_ok=True); continue
                    ok,msg=valid(d)
                    if not ok:
                        stats['invalid_candidates']+=1; attempt={'engine':engine,'url':final,'result':'invalid-pdf','validation':msg,'bytes':d.stat().st_size}; d.unlink(missing_ok=True); continue
                    item={'source':'global:'+engine,'url':final,'bytes':d.stat().st_size,'sha256':sha(d),'validation':{'ok':True,'output':msg},'status':'acquired_for_review','local_path':str(d)}
                    found.append(item); attempt={'engine':engine,'url':final,'result':'acquired','bytes':item['bytes'],'sha256':item['sha256'],'content_type':ctype}
            except Exception as exc:
                stats['errors']+=1; attempt['result']='error'; attempt['error']=f'{type(exc).__name__}: {exc}'[:500]
            gap['attempts'].append(attempt)
        if found:
            rec.setdefault('candidates',[]).extend(found); rec['acquired']=acquired+found; rec['acquired_count']=len(rec['acquired']); rec['availability']='copy-acquired'; rec['acquisition_state']='acquired'; rec['rights_action']='developer-vault-encrypt'; gap['result']='acquired'; stats['new_acquired_books']+=1; stats['new_acquired_files']+=len(found)
        else:
            rec.setdefault('retry_history',[]).append({'pass':'deep-worldwide-v3','result':'no-match','attempts':gap['attempts']})
        stats['gaps'].append(gap)
    counts=data.setdefault('counts',{}); counts['acquired_books']=sum(r.get('availability')=='copy-acquired' for r in records); counts['acquired_files']=sum(int(r.get('acquired_count',0)) for r in records); counts['global_search_no_match']=sum(r.get('acquisition_state')=='global-search-no-match' for r in records)
    data['schema']='developer-review-acquisition/v8'; mp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); report.parent.mkdir(parents=True,exist_ok=True); report.write_text(json.dumps(stats,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in stats.items() if k not in ('gaps','source_attempts')} | {'source_attempts':stats['source_attempts']},ensure_ascii=False,sort_keys=True))

if __name__=='__main__': main()
