#!/usr/bin/env python3
"""Retry only unresolved acquisitions using broader, deterministic discovery queries.

This is an acquisition layer, not a rights layer. It never publishes a copy and
never bypasses access controls. It only accepts real PDFs that pass qpdf.
"""
import argparse, hashlib, html, json, re, subprocess
from pathlib import Path
from urllib.parse import quote, urlencode, urljoin
from urllib.request import Request, urlopen

UA='DinAllah-Encyclopedia/rechercher-no-match-retry/1.0'
ENGINES=('internet_archive','nyu_aco','wikimedia_commons','wikisource')

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
    if path.read_bytes()[:5] != b'%PDF-': return False,'invalid_pdf_signature'
    r=subprocess.run(['qpdf','--check',str(path)],text=True,capture_output=True)
    return r.returncode==0,(r.stdout+r.stderr).strip()

def norm(s):
    return ' '.join(str(s or '').split()).strip()

def terms(book):
    title=norm(book.get('title')); author=norm(book.get('author'))
    return [x for x in (title,author) if x]

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
            for _,n in sorted(files,reverse=True)[:6]:
                out.append('https://archive.org/download/'+quote(ident,safe='')+'/'+quote(n,safe=''))
    return list(dict.fromkeys(out))

def mediawiki_candidates(api,book):
    q=' '.join(terms(book)); out=[]
    if not q: return out
    variants=[q]
    title=norm(book.get('title')); author=norm(book.get('author'))
    if title: variants.append(title)
    if author: variants.append(author)
    for query in dict.fromkeys(variants):
        params={'action':'query','generator':'search','gsrsearch':query,'gsrnamespace':6,'gsrlimit':20,'prop':'imageinfo','iiprop':'url','format':'json'}
        try: data=json.loads(fetch(api+'?'+urlencode(params))[0].decode('utf-8','replace'))
        except Exception: continue
        for p in (data.get('query',{}).get('pages',{}) or {}).values():
            for info in p.get('imageinfo',[]) or []:
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

def candidates(book):
    out=[]
    for engine,fn in [
        ('internet_archive',archive_candidates),
        ('nyu_aco',lambda b: []),
        ('wikimedia_commons',lambda b:mediawiki_candidates('https://commons.wikimedia.org/w/api.php',b)),
        ('wikisource',lambda b:mediawiki_candidates('https://ar.wikisource.org/w/api.php',b)),
    ]:
        try:
            urls=fn(book)
            for u in urls: out.append((engine,u))
        except Exception: continue
    return list(dict.fromkeys(out))

def main():
    p=argparse.ArgumentParser(); p.add_argument('--manifest',required=True); p.add_argument('--vault',required=True); p.add_argument('--report',required=True); p.add_argument('--max-books',type=int,default=0); a=p.parse_args()
    mp=Path(a.manifest); vault=Path(a.vault); report=Path(a.report); data=json.loads(mp.read_text(encoding='utf-8')); records=data.get('records',[])
    gaps=[r for r in records if r.get('acquisition_state')=='global-search-no-match']
    if a.max_books: gaps=gaps[:a.max_books]
    stats={'input_gaps':len(gaps),'new_acquired_books':0,'new_acquired_files':0,'invalid_candidates':0,'errors':0}
    for rec in gaps:
        book={'id':rec.get('id'),'title':rec.get('title'),'author':rec.get('author'),'author_death_hijri':rec.get('author_death_hijri'),'edition':rec.get('edition')}
        target=1
        acquired=list(rec.get('acquired') or [])
        found=[]
        for engine,url in candidates(book):
            if len(acquired)+len(found)>=target: break
            dest=vault/(rec['id']+'--retry-'+hashlib.sha256(url.encode()).hexdigest()[:20]+'.pdf'); dest.parent.mkdir(parents=True,exist_ok=True)
            try:
                urls=page_pdf_candidates(url)
                for pdf in urls[:12]:
                    if len(acquired)+len(found)>=target: break
                    d=vault/(rec['id']+'--retry-'+hashlib.sha256(pdf.encode()).hexdigest()[:20]+'.pdf')
                    raw,_,final=fetch(pdf); d.write_bytes(raw); ok,msg=valid(d)
                    if not ok:
                        stats['invalid_candidates']+=1; d.unlink(missing_ok=True); continue
                    item={'source':'global:'+engine,'url':final,'bytes':d.stat().st_size,'sha256':sha(d),'validation':{'ok':True,'output':msg},'status':'acquired_for_review','local_path':str(d)}
                    found.append(item)
            except Exception:
                stats['errors']+=1
            finally: dest.unlink(missing_ok=True)
        if found:
            rec.setdefault('candidates',[]).extend(found); rec['acquired']=acquired+found; rec['acquired_count']=len(rec['acquired']); rec['availability']='copy-acquired'; rec['acquisition_state']='acquired'; rec['rights_action']='developer-vault-encrypt'; stats['new_acquired_books']+=1; stats['new_acquired_files']+=len(found)
        else:
            rec.setdefault('retry_history',[]).append({'pass':'multi-pass-v1','result':'no-match'})
    data['counts']['acquired_books']=sum(r.get('availability')=='copy-acquired' for r in records)
    data['counts']['acquired_files']=sum(int(r.get('acquired_count',0)) for r in records)
    data['counts']['global_search_no_match']=sum(r.get('acquisition_state')=='global-search-no-match' for r in records)
    data['schema']='developer-review-acquisition/v6'
    mp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    report.parent.mkdir(parents=True,exist_ok=True); report.write_text(json.dumps(stats,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(stats,ensure_ascii=False,sort_keys=True))
if __name__=='__main__': main()
