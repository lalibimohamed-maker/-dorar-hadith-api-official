#!/usr/bin/env python3
"""Acquire catalogued copies for developer review without deleting successful downloads.

This script deliberately separates availability from redistribution rights. It never
removes a downloaded copy. Restricted/unverified copies are encrypted by the caller.
"""
import argparse, hashlib, json, subprocess
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen
import re, html

p = argparse.ArgumentParser()
p.add_argument('--root', required=True)
p.add_argument('--catalog', default='books-batches/salaf-01-400h/catalog.json')
p.add_argument('--out', default='books-batches/salaf-01-400h/developer-review-manifest.json')
p.add_argument('--vault', default='artifacts/developer-review-vault')
a = p.parse_args()
root = Path(a.root).resolve(); catalog_path = root/a.catalog; out = root/a.out; vault = root/a.vault
UA='DinAllah-Encyclopedia/developer-review-acquisition/1.0'

def norm(u): return u.split('#',1)[0]
def text(u):
    with urlopen(Request(norm(u), headers={'User-Agent':UA}), timeout=90) as r:
        return r.read().decode('utf-8','replace')
def links(page, base):
    seen=[]
    for m in re.finditer(r'href=["\']([^"\']+)["\']', page, re.I):
        u=norm(urljoin(base, html.unescape(m.group(1))))
        if re.search(r'\.pdf(?:\?|$)',u,re.I) and u not in seen: seen.append(u)
    return seen

def sources(book):
    s=[]
    if book.get('waqfeya_url'): s.append((book['waqfeya_url'],True))
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

def main():
    cat=json.loads(catalog_path.read_text(encoding='utf-8'))
    vault.mkdir(parents=True,exist_ok=True); records=[]
    for book in cat['books']:
        rec={'id':book['id'],'title':book['title'],'author':book.get('author'),'author_death_hijri':book.get('author_death_hijri'),'edition':book.get('edition'),'catalog_rights_status':book.get('rights_status'),'candidates':[]}
        found=False
        for source,discover in sources(book):
            try: urls=links(text(source),source) if discover else [source]
            except Exception as e:
                rec['candidates'].append({'source':source,'status':'source_error','error':str(e)}); continue
            for u in urls[:20]:
                name=hashlib.sha256(u.encode()).hexdigest()+'.pdf'; dest=vault/(book['id']+'--'+name)
                try:
                    with urlopen(Request(u,headers={'User-Agent':UA}),timeout=120) as r: dest.write_bytes(r.read())
                    ok,msg=valid(dest)
                    item={'source':source,'url':u,'bytes':dest.stat().st_size,'sha256':sha(dest),'validation':{'ok':ok,'output':msg}}
                    if not ok: dest.unlink(missing_ok=True); item['status']='invalid_pdf'; rec['candidates'].append(item); continue
                    item['status']='acquired_for_review'; item['local_path']=str(dest.relative_to(root)); rec['candidates'].append(item); rec['acquired']=item; found=True; break
                except Exception as e:
                    dest.unlink(missing_ok=True); rec['candidates'].append({'source':source,'url':u,'status':'download_error','error':str(e)})
            if found: break
        rec['availability']='copy-acquired' if found else 'not-acquired'
        rec['rights_action']='public-eligible' if found and book.get('rights_status')=='verified-redistributable' else ('developer-vault-encrypt' if found else 'none')
        records.append(rec)
    summary={'schema':'developer-review-acquisition/v1','scope':cat['scope'],'principle':'catalog completeness is independent from redistribution rights; acquired copies are retained for review and are never deleted by this acquisition step','records':records,'counts':{'books':len(records),'acquired':sum(r['availability']=='copy-acquired' for r in records)}}
    out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary['counts'],ensure_ascii=False))
if __name__=='__main__': main()
