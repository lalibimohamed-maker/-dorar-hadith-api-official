#!/usr/bin/env python3
"""Multi-pass retry for unresolved PDF acquisitions.

Acquisition is deliberately separated from rights/publication.  A copy is
accepted only after a real %PDF- payload passes qpdf and receives a SHA-256.
Every gap keeps a machine-readable attempt history so a successful workflow
cannot hide unresolved books.
"""
import argparse, hashlib, html, json, re, subprocess
from pathlib import Path
from urllib.parse import quote, urlencode, urljoin
from urllib.request import Request, urlopen

UA='DinAllah-Encyclopedia/rechercher-no-match-retry/2.0'
ENGINES=('saved_sources','internet_archive','wikimedia_commons','wikisource')


def fetch(url):
    req=Request(url,headers={'User-Agent':UA})
    with urlopen(req,timeout=90) as r:
        return r.read(),(r.headers.get('Content-Type') or '').lower(),r.geturl()


def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for c in iter(lambda:f.read(1024*1024),b''): h.update(c)
    return h.hexdigest()


def valid(path):
    if path.read_bytes()[:5] != b'%PDF-':
        return False,'invalid_pdf_signature'
    r=subprocess.run(['qpdf','--check',str(path)],text=True,capture_output=True)
    return r.returncode==0,(r.stdout+r.stderr).strip()


def norm(s):
    return ' '.join(str(s or '').split()).strip()


def terms(book):
    return [x for x in (norm(book.get('title')),norm(book.get('author'))) if x]


def archive_candidates(book):
    title=norm(book.get('title')); author=norm(book.get('author')); queries=[]
    if title and author: queries.append(f'title:"{title}" AND creator:"{author}"')
    if title: queries.append(f'title:"{title}"')
    if author: queries.append(f'creator:"{author}"')
    if title:
        words=[w for w in re.split(r'\s+',title) if len(w)>2]
        if words: queries.append(' AND '.join(f'title:{w}' for w in words[:6]))
    out=[]
    for q in dict.fromkeys(queries):
        url='https://archive.org/advancedsearch.php?'+urlencode({'q':q,'fl[]':'identifier','rows':20,'page':1,'output':'json'})
        try: data=json.loads(fetch(url)[0].decode('utf-8','replace'))
        except Exception: continue
        for doc in data.get('response',{}).get('docs',[]):
            ident=doc.get('identifier')
            if not ident: continue
            try: meta=json.loads(fetch('https://archive.org/metadata/'+quote(ident,safe=''))[0].decode('utf-8','replace'))
            except Exception: continue
            files=[]
            for f in meta.get('files',[]):
                n=f.get('name','')
                if n.lower().endswith('.pdf') and not n.lower().endswith(('_text.pdf','_scandata.pdf')):
                    files.append((int(f.get('size') or 0),n))
            for _,n in sorted(files,reverse=True)[:8]:
                out.append('https://archive.org/download/'+quote(ident,safe='')+'/'+quote(n,safe=''))
    return list(dict.fromkeys(out))


def mediawiki_candidates(api,book):
    q=' '.join(terms(book)); out=[]
    if not q: return out
    title=norm(book.get('title')); author=norm(book.get('author'))
    variants=[q]
    if title: variants.append(title)
    if author: variants.append(author)
    for query in dict.fromkeys(variants):
        params={'action':'query','generator':'search','gsrsearch':query,'gsrnamespace':6,'gsrlimit':30,'prop':'imageinfo','iiprop':'url','format':'json'}
        try: data=json.loads(fetch(api+'?'+urlencode(params))[0].decode('utf-8','replace'))
        except Exception: continue
        for page in (data.get('query',{}).get('pages',{}) or {}).values():
            for info in page.get('imageinfo',[]) or []:
                u=info.get('url')
                if u and re.search(r'\.pdf(?:$|\?)',u,re.I): out.append(u)
    return list(dict.fromkeys(out))


def page_pdf_candidates(url):
    try: data,ctype,final=fetch(url)
    except Exception: return []
    if data[:5]==b'%PDF-' or 'pdf' in ctype: return [final]
    text=data.decode('utf-8','replace'); out=[]
    for m in re.finditer(r'href=["\']([^"\']+)["\']',text,re.I):
        u=urljoin(final,html.unescape(m.group(1)))
        if re.search(r'\.pdf(?:\?|$)',u,re.I) and not re.search(r'\.pdf\.enc(?:\?|$)',u,re.I): out.append(u)
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
        if isinstance(item,dict) and item.get('url'):
            out.append(item['url'])
    return list(dict.fromkeys(u for u in out if isinstance(u,str) and u.startswith(('http://','https://'))))


def candidates(rec):
    out=[('saved_sources',u) for u in saved_source_candidates(rec)]
    book=rec
    for engine,fn in [
        ('internet_archive',archive_candidates),
        ('wikimedia_commons',lambda b:mediawiki_candidates('https://commons.wikimedia.org/w/api.php',b)),
        ('wikisource',lambda b:mediawiki_candidates('https://ar.wikisource.org/w/api.php',b)),
    ]:
        try:
            for u in fn(book): out.append((engine,u))
        except Exception: continue
    return list(dict.fromkeys(out))


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--manifest',required=True); p.add_argument('--vault',required=True)
    p.add_argument('--report',required=True); p.add_argument('--max-books',type=int,default=0)
    a=p.parse_args()
    mp=Path(a.manifest); vault=Path(a.vault); report=Path(a.report)
    data=json.loads(mp.read_text(encoding='utf-8')); records=data.get('records',[])
    gaps=[r for r in records if r.get('acquisition_state')=='global-search-no-match']
    if a.max_books: gaps=gaps[:a.max_books]
    stats={'schema':'rechercher-multipass-retry/v2','input_gaps':len(gaps),'new_acquired_books':0,'new_acquired_files':0,'invalid_candidates':0,'errors':0,'gaps':[]}
    for rec in gaps:
        gap={'id':rec.get('id'),'title':rec.get('title'),'author':rec.get('author'),'attempts':[],'result':'no-match'}
        acquired=list(rec.get('acquired') or []); found=[]; seen_urls=set()
        for engine,url in candidates(rec):
            if len(acquired)+len(found)>=1: break
            if url in seen_urls: continue
            seen_urls.add(url)
            attempt={'engine':engine,'url':url,'result':'no-pdf'}
            try:
                pdf_urls=page_pdf_candidates(url)
                if not pdf_urls: attempt['result']='no-pdf'
                for pdf in pdf_urls[:12]:
                    if len(acquired)+len(found)>=1: break
                    d=vault/(rec['id']+'--retry-'+hashlib.sha256(pdf.encode()).hexdigest()[:20]+'.pdf')
                    raw,_,final=fetch(pdf); d.write_bytes(raw); ok,msg=valid(d)
                    if not ok:
                        stats['invalid_candidates']+=1
                        attempt={'engine':engine,'url':final,'result':'invalid-pdf','validation':msg}
                        d.unlink(missing_ok=True); continue
                    item={'source':'global:'+engine,'url':final,'bytes':d.stat().st_size,'sha256':sha(d),'validation':{'ok':True,'output':msg},'status':'acquired_for_review','local_path':str(d)}
                    found.append(item); attempt={'engine':engine,'url':final,'result':'acquired','bytes':item['bytes'],'sha256':item['sha256']}
            except Exception as exc:
                stats['errors']+=1; attempt['result']='error'; attempt['error']=f'{type(exc).__name__}: {exc}'[:500]
            gap['attempts'].append(attempt)
        if found:
            rec.setdefault('candidates',[]).extend(found)
            rec['acquired']=acquired+found; rec['acquired_count']=len(rec['acquired'])
            rec['availability']='copy-acquired'; rec['acquisition_state']='acquired'; rec['rights_action']='developer-vault-encrypt'
            gap['result']='acquired'; stats['new_acquired_books']+=1; stats['new_acquired_files']+=len(found)
        else:
            rec.setdefault('retry_history',[]).append({'pass':'multi-pass-v2','result':'no-match','attempts':gap['attempts']})
        stats['gaps'].append(gap)
    counts=data.setdefault('counts',{})
    counts['acquired_books']=sum(r.get('availability')=='copy-acquired' for r in records)
    counts['acquired_files']=sum(int(r.get('acquired_count',0)) for r in records)
    counts['global_search_no_match']=sum(r.get('acquisition_state')=='global-search-no-match' for r in records)
    data['schema']='developer-review-acquisition/v7'
    mp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    report.parent.mkdir(parents=True,exist_ok=True); report.write_text(json.dumps(stats,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in stats.items() if k!='gaps'},ensure_ascii=False,sort_keys=True))

if __name__=='__main__': main()
