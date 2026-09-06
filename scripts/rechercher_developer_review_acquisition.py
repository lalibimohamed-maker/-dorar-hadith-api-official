#!/usr/bin/env python3
"""Acquire catalogued copies for developer review.

Explicit sources are tried first. When a catalogued work has no explicit source,
Internet Archive's metadata API is queried for a concrete PDF candidate. Every
copy is validated and retained only in the encrypted developer-review vault;
source discovery never implies redistribution rights.
"""
import argparse, hashlib, json, re, html, unicodedata, subprocess
from pathlib import Path
from urllib.parse import urljoin, urlencode, quote
from urllib.request import Request, urlopen

p=argparse.ArgumentParser(); p.add_argument('--root',required=True); p.add_argument('--catalog',default='books-batches/salaf-01-400h/catalog.json'); p.add_argument('--discovery',action='append',default=None); p.add_argument('--out',default='books-batches/salaf-01-400h/developer-review-manifest.json'); p.add_argument('--vault',default='artifacts/developer-review-vault'); a=p.parse_args()
root=Path(a.root).resolve(); catalog_path=root/a.catalog; out=root/a.out; vault=root/a.vault
UA='DinAllah-Encyclopedia/developer-review-acquisition/1.3'
DEFAULT_DISCOVERY=['books-batches/salaf-01-400h/master-discovery-additions-2026.json','books-batches/salaf-01-400h/worldwide-deep-research-wave-2026-09.json']

def norm(u): return u.split('#',1)[0]
def fetch(u):
    req=Request(norm(u),headers={'User-Agent':UA})
    with urlopen(req,timeout=120) as r: return r.read(),(r.headers.get('Content-Type') or '').lower(),r.geturl()
def page_text(u):
    data,ctype,final=fetch(u)
    if 'pdf' in ctype or data[:5]==b'%PDF-': return None,ctype,final
    return data.decode('utf-8','replace'),ctype,final
def links(page,base):
    seen=[]
    for m in re.finditer(r'href=["\']([^"\']+)["\']',page,re.I):
        u=norm(urljoin(base,html.unescape(m.group(1))))
        if re.search(r'\.pdf(?:\?|$)',u,re.I) or 'archive.org/download/' in u.lower():
            if u not in seen: seen.append(u)
    return seen
def candidate_urls(source):
    page,ctype,final=page_text(source)
    return [final] if page is None else links(page,final)
def sources(book):
    s=[]
    if book.get('waqfeya_url'): s.append((book['waqfeya_url'],True))
    for k in ('source_url','url'):
        if book.get(k): s.append((book[k],False))
    for x in book.get('sources',[]):
        u=x if isinstance(x,str) else x.get('url')
        if u: s.append((u,False))
    return s
def archive_urls(book):
    title=' '.join((book.get('title') or '').split()); author=' '.join((book.get('author') or '').split())
    parts=[]
    if title: parts.append(f'title:"{title}"')
    if author: parts.append(f'creator:"{author}"')
    q=' AND '.join(parts)
    if not q: return []
    search='https://archive.org/advancedsearch.php?'+urlencode({'q':q,'fl[]':'identifier','rows':8,'page':1,'output':'json'})
    try: data=json.loads(fetch(search)[0].decode('utf-8','replace'))
    except Exception: return []
    result=[]
    for doc in data.get('response',{}).get('docs',[]):
        ident=doc.get('identifier')
        if not ident: continue
        try: meta=json.loads(fetch('https://archive.org/metadata/'+quote(ident,safe=''))[0].decode('utf-8','replace'))
        except Exception: continue
        pdfs=[]
        for f in meta.get('files',[]):
            name=f.get('name','')
            if name.lower().endswith('.pdf') and not name.lower().endswith(('_text.pdf','_scandata.pdf')): pdfs.append((int(f.get('size') or 0),name))
        for _,name in sorted(pdfs,reverse=True)[:3]: result.append('https://archive.org/download/'+quote(ident,safe='')+'/'+quote(name,safe=''))
    return result
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for c in iter(lambda:f.read(1024*1024),b''): h.update(c)
    return h.hexdigest()
def valid(path):
    r=subprocess.run(['qpdf','--check',str(path)],text=True,capture_output=True); return r.returncode==0,(r.stdout+r.stderr).strip()
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
    books.sort(key=lambda b:(b.get('author_death_hijri') or b.get('death_hijri') or 10**9,b.get('title') or '')); return cat,books,loaded
def main():
    cat,books,loaded=build_books(); vault.mkdir(parents=True,exist_ok=True); records=[]
    for book in books:
        rec={'id':book['id'],'title':book['title'],'author':book.get('author'),'author_death_hijri':book.get('author_death_hijri',book.get('death_hijri')),'edition':book.get('edition'),'catalog_rights_status':book.get('rights_status'),'status':book.get('status'),'discovery_registries':book.get('discovery_registries',[]),'candidates':[]}; acquired=[]; target=book.get('expected_volumes') or 1; srcs=sources(book)
        if not srcs: srcs=[('archive-search',False)]
        for source,_ in srcs:
            try: urls=archive_urls(book) if source=='archive-search' else candidate_urls(source)
            except Exception as e: rec['candidates'].append({'source':source,'status':'source_error','error':str(e)}); continue
            for u in urls[:60]:
                if any(x.get('url')==u and x.get('status')=='acquired_for_review' for x in rec['candidates']): continue
                dest=vault/(book['id']+'--'+hashlib.sha256(u.encode()).hexdigest()[:20]+'.pdf')
                try:
                    data,ctype,final=fetch(u); dest.write_bytes(data); ok,msg=valid(dest); item={'source':source,'url':final,'bytes':dest.stat().st_size,'sha256':sha(dest),'validation':{'ok':ok,'output':msg}}
                    if not ok: dest.unlink(missing_ok=True); item['status']='invalid_pdf'; rec['candidates'].append(item); continue
                    item['status']='acquired_for_review'; item['local_path']=str(dest.relative_to(root)); rec['candidates'].append(item); acquired.append(item)
                    if len(acquired)>=target: break
                except Exception as e: dest.unlink(missing_ok=True); rec['candidates'].append({'source':source,'url':u,'status':'download_error','error':str(e)})
            if len(acquired)>=target: break
        rec['availability']='copy-acquired' if acquired else 'not-acquired'; rec['acquisition_state']='acquired' if acquired else ('archive-search-no-match' if srcs[0][0]=='archive-search' else 'source-unusable'); rec['acquired']=acquired; rec['acquired_count']=len(acquired); rec['rights_action']='public-eligible' if acquired and book.get('rights_status')=='verified-redistributable' else ('developer-vault-encrypt' if acquired else 'none'); records.append(rec)
    summary={'schema':'developer-review-acquisition/v4','scope':cat['scope'],'discovery_registries_loaded':loaded,'principle':'catalog/discovery completeness is independent from redistribution rights; acquired copies are retained for review and never published by this acquisition step','records':records,'counts':{'books':len(records),'acquired_books':sum(r['availability']=='copy-acquired' for r in records),'acquired_files':sum(r['acquired_count'] for r in records),'no_explicit_source':sum(r['acquisition_state']=='no-explicit-source' for r in records),'source_unusable':sum(r['acquisition_state'] in ('source-unusable','archive-search-no-match') for r in records)}}
    out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); print(json.dumps(summary['counts'],ensure_ascii=False,sort_keys=True))
if __name__=='__main__': main()
