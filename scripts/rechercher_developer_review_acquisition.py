#!/usr/bin/env python3
"""Acquire catalogued copies for developer review without deleting successful downloads.

The historical discovery work is authoritative for scope, but acquisition remains
edition/source/rights gated. This script merges the preserved discovery registries
with the curated catalog, de-duplicates records, and acquires only records that
have an explicit source URL. Discovery records without a source URL are retained
in the manifest instead of silently disappearing from the acquisition pipeline.
"""
import argparse, hashlib, json, re, html, unicodedata, subprocess
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen

p = argparse.ArgumentParser()
p.add_argument('--root', required=True)
p.add_argument('--catalog', default='books-batches/salaf-01-400h/catalog.json')
p.add_argument('--discovery', action='append', default=None,
               help='Additional preserved discovery JSON registry; may be repeated.')
p.add_argument('--out', default='books-batches/salaf-01-400h/developer-review-manifest.json')
p.add_argument('--vault', default='artifacts/developer-review-vault')
a = p.parse_args()
root = Path(a.root).resolve(); catalog_path = root/a.catalog; out = root/a.out; vault = root/a.vault
UA='DinAllah-Encyclopedia/developer-review-acquisition/1.2'
DEFAULT_DISCOVERY = [
    'books-batches/salaf-01-400h/master-discovery-additions-2026.json',
    'books-batches/salaf-01-400h/worldwide-deep-research-wave-2026-09.json',
]

def norm(u): return u.split('#',1)[0]

def fetch(u):
    req=Request(norm(u), headers={'User-Agent':UA})
    with urlopen(req, timeout=120) as r:
        data=r.read()
        ctype=(r.headers.get('Content-Type') or '').lower()
        return data, ctype, r.geturl()

def page_text(u):
    data, ctype, final_url=fetch(u)
    if 'pdf' in ctype or data[:5] == b'%PDF-':
        return None, ctype, final_url
    return data.decode('utf-8','replace'), ctype, final_url

def links(page, base):
    seen=[]
    for m in re.finditer(r'href=["\']([^"\']+)["\']', page, re.I):
        u=norm(urljoin(base, html.unescape(m.group(1))))
        if (re.search(r'\.pdf(?:\?|$)',u,re.I)
                or 'archive.org/download/' in u.lower()):
            if u not in seen: seen.append(u)
    return seen

def sources(book):
    s=[]
    if book.get('waqfeya_url'): s.append((book['waqfeya_url'],True))
    for key in ('source_url','url'):
        u=book.get(key)
        if u: s.append((u,False))
    for x in book.get('sources',[]):
        u=x if isinstance(x,str) else x.get('url')
        if u: s.append((u,False))
    return s

def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for c in iter(lambda:f.read(1024*1024),b''): h.update(c)
    return h.hexdigest()

def valid(path):
    r=subprocess.run(['qpdf','--check',str(path)],text=True,capture_output=True)
    return r.returncode==0, (r.stdout+r.stderr).strip()

def candidate_urls(source):
    page, ctype, final_url=page_text(source)
    if page is None:
        return [final_url]
    return links(page, final_url)

def key_for(book):
    title=' '.join((book.get('title') or '').split())
    author=' '.join((book.get('author') or '').split())
    death=str(book.get('author_death_hijri') or book.get('death_hijri') or '')
    return (title, author, death)

def slug(value):
    value=unicodedata.normalize('NFKD', value or '')
    value=''.join(c for c in value if not unicodedata.combining(c))
    value=re.sub(r'[^\w\-]+','-',value,flags=re.UNICODE).strip('-_').lower()
    return value[:70] or 'work'

def stable_id(book):
    raw='|'.join(key_for(book))
    return slug(book.get('id') or book.get('title') or 'work') + '--' + hashlib.sha256(raw.encode('utf-8')).hexdigest()[:12]

def load_discovery(path):
    data=json.loads(path.read_text(encoding='utf-8'))
    entries=data.get('entries', [])
    result=[]
    for e in entries:
        if not e.get('title'): continue
        result.append({
            'id': e.get('id'),
            'title': e.get('title'),
            'author': e.get('author'),
            'author_death_hijri': e.get('author_death_hijri', e.get('death_hijri')),
            'rights_status': e.get('rights_status', 'discovery-only'),
            'status': e.get('status'),
            'note': e.get('note'),
            'edition': e.get('edition'),
            'expected_volumes': e.get('expected_volumes'),
            'waqfeya_url': e.get('waqfeya_url'),
            'source_url': e.get('source_url'),
            'sources': e.get('sources', []),
            'discovery_registry': str(path.relative_to(root)),
        })
    return result

def build_books():
    cat=json.loads(catalog_path.read_text(encoding='utf-8'))
    merged={key_for(b): dict(b) for b in cat.get('books', [])}
    discovery_paths=a.discovery if a.discovery is not None else DEFAULT_DISCOVERY
    loaded=[]
    for rel in discovery_paths:
        path=root/rel
        if not path.exists():
            raise FileNotFoundError(f'missing discovery registry: {rel}')
        loaded.append(str(path.relative_to(root)))
        for e in load_discovery(path):
            k=key_for(e)
            if k not in merged:
                e['id']=e.get('id') or stable_id(e)
                merged[k]=e
            else:
                # Preserve curated catalog fields, while retaining discovery provenance.
                b=merged[k]
                b.setdefault('discovery_registries', [])
                if str(path.relative_to(root)) not in b['discovery_registries']:
                    b['discovery_registries'].append(str(path.relative_to(root)))
                for field in ('waqfeya_url','source_url','edition','expected_volumes'):
                    if not b.get(field) and e.get(field): b[field]=e[field]
                if e.get('sources'):
                    b.setdefault('sources', [])
                    for s in e['sources']:
                        if s not in b['sources']: b['sources'].append(s)
    books=[]
    for b in merged.values():
        b['id']=b.get('id') or stable_id(b)
        books.append(b)
    books.sort(key=lambda b:(b.get('author_death_hijri') or b.get('death_hijri') or 10**9, b.get('title') or ''))
    return cat, books, loaded

def main():
    cat, books, discovery_loaded=build_books()
    vault.mkdir(parents=True,exist_ok=True); records=[]
    for book in books:
        rec={'id':book['id'],'title':book['title'],'author':book.get('author'),
             'author_death_hijri':book.get('author_death_hijri',book.get('death_hijri')),
             'edition':book.get('edition'),'catalog_rights_status':book.get('rights_status'),
             'status':book.get('status'),'discovery_registries':book.get('discovery_registries',[]),
             'candidates':[]}
        acquired_items=[]
        srcs=sources(book)
        target=book.get('expected_volumes') or 1
        if not srcs:
            rec['availability']='not-acquired'
            rec['acquisition_state']='no-explicit-source'
            rec['acquired']=[]
            rec['acquired_count']=0
            rec['rights_action']='none'
            records.append(rec)
            continue
        for source,discover in srcs:
            try:
                urls=candidate_urls(source)
            except Exception as e:
                rec['candidates'].append({'source':source,'status':'source_error','error':str(e)}); continue
            for u in urls[:60]:
                if any(x.get('url') == u and x.get('status') == 'acquired_for_review' for x in rec['candidates']):
                    continue
                suffix=hashlib.sha256(u.encode()).hexdigest()[:20]
                dest=vault/(book['id']+'--'+suffix+'.pdf')
                try:
                    data, ctype, final_url=fetch(u)
                    dest.write_bytes(data)
                    ok,msg=valid(dest)
                    item={'source':source,'url':final_url,'bytes':dest.stat().st_size,'sha256':sha(dest),'validation':{'ok':ok,'output':msg}}
                    if not ok:
                        dest.unlink(missing_ok=True); item['status']='invalid_pdf'; rec['candidates'].append(item); continue
                    item['status']='acquired_for_review'; item['local_path']=str(dest.relative_to(root)); rec['candidates'].append(item); acquired_items.append(item)
                    if len(acquired_items) >= target: break
                except Exception as e:
                    dest.unlink(missing_ok=True); rec['candidates'].append({'source':source,'url':u,'status':'download_error','error':str(e)})
            if len(acquired_items) >= target: break
        rec['availability']='copy-acquired' if acquired_items else 'not-acquired'
        rec['acquisition_state']='acquired' if acquired_items else 'source-unusable'
        rec['acquired']=acquired_items
        rec['acquired_count']=len(acquired_items)
        rec['rights_action']='public-eligible' if acquired_items and book.get('rights_status')=='verified-redistributable' else ('developer-vault-encrypt' if acquired_items else 'none')
        records.append(rec)
    summary={'schema':'developer-review-acquisition/v3','scope':cat['scope'],
             'discovery_registries_loaded':discovery_loaded,
             'principle':'catalog/discovery completeness is independent from redistribution rights; acquired copies are retained for review and are never deleted by this acquisition step',
             'records':records,
             'counts':{
                 'books':len(records),
                 'acquired_books':sum(r['availability']=='copy-acquired' for r in records),
                 'acquired_files':sum(r['acquired_count'] for r in records),
                 'no_explicit_source':sum(r['acquisition_state']=='no-explicit-source' for r in records),
                 'source_unusable':sum(r['acquisition_state']=='source-unusable' for r in records),
             }}
    out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary['counts'],ensure_ascii=False,sort_keys=True))
if __name__=='__main__': main()
