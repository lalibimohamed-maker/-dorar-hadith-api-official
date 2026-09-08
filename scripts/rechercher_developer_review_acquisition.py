#!/usr/bin/env python3
"""Acquire catalogued copies for developer review without false positives.

Availability is separate from redistribution rights. A PDF is only marked
acquired after both technical PDF validation and bibliographic content-identity
verification. Scanned PDFs with insufficient identity evidence remain retained
for review but are not counted as acquired. Downloaded candidates are never
silently deleted after a successful HTTP transfer.
"""
import argparse, hashlib, json, subprocess, time
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import re, html, unicodedata

p = argparse.ArgumentParser()
p.add_argument('--root', required=True)
p.add_argument('--catalog', default='books-batches/salaf-01-400h/catalog.json')
p.add_argument('--out', default='books-batches/salaf-01-400h/developer-review-manifest.json')
p.add_argument('--vault', default='artifacts/developer-review-vault')
a = p.parse_args()
root = Path(a.root).resolve(); catalog_path = root/a.catalog; out = root/a.out; vault = root/a.vault
UA='DinAllah-Encyclopedia/developer-review-acquisition/2.0'


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


def normalize_text(s):
    s = unicodedata.normalize('NFKC', s or '').lower()
    s = re.sub(r'[\u064B-\u065F\u0670\u06D6-\u06ED]', '', s)
    s = re.sub(r'[إأآٱ]', 'ا', s)
    s = s.replace('ى','ي').replace('ة','ه').replace('ؤ','و').replace('ئ','ي')
    s = re.sub(r'[^\w\u0600-\u06FF]+', ' ', s, flags=re.UNICODE)
    return re.sub(r'\s+', ' ', s).strip()


def meaningful_tokens(s):
    stop={'كتاب','الكتاب','في','من','عن','بن','ابن','ابي','أبو','ابو','و','ال','تفسير','جامع','جزء','رساله','رسالة','شرح','مسند','مسندات','المغازي','مغازي'}
    return [t for t in normalize_text(s).split() if len(t) >= 3 and t not in stop]


def extract_identity(path):
    """Return first-pages text and PDF metadata without making OCR authoritative."""
    result={'text':'','metadata':{},'text_available':False}
    try:
        r=subprocess.run(['pdftotext','-f','1','-l','5','-layout',str(path),'-'],text=True,capture_output=True,timeout=120)
        if r.returncode==0:
            result['text']=r.stdout[:50000]
            result['text_available']=bool(result['text'].strip())
    except Exception:
        pass
    try:
        r=subprocess.run(['pdfinfo',str(path)],text=True,capture_output=True,timeout=60)
        if r.returncode==0:
            for line in r.stdout.splitlines():
                if ':' in line:
                    k,v=line.split(':',1)
                    result['metadata'][k.strip().lower()]=v.strip()
    except Exception:
        pass
    return result


def identity_match(book, path):
    """Conservative title/author check; never treats PDF integrity as identity."""
    ident=extract_identity(path)
    hay=normalize_text(ident['text']+' '+' '.join(ident['metadata'].values()))
    title_tokens=meaningful_tokens(book.get('title',''))
    author_tokens=meaningful_tokens(book.get('author',''))
    title_hits=sum(t in hay for t in title_tokens)
    author_hits=sum(t in hay for t in author_tokens)
    title_ok=bool(title_tokens) and title_hits >= max(1, min(2,len(title_tokens)))
    author_ok=bool(author_tokens) and author_hits >= max(1, min(1,len(author_tokens)))
    # Strong bibliographic evidence: title signal plus author signal. For very
    # short/ambiguous titles, require multiple title tokens and author metadata/text.
    verified=title_ok and author_ok
    if not ident['text_available'] and not ident['metadata'].get('title') and not ident['metadata'].get('author'):
        state='content_identity_unverified'
    elif verified:
        state='content_identity_verified'
    else:
        state='metadata_mismatch' if ident['text_available'] or ident['metadata'] else 'content_identity_unverified'
    return {
        'status':state,
        'verified':verified,
        'title_tokens':title_tokens,
        'author_tokens':author_tokens,
        'title_hits':title_hits,
        'author_hits':author_hits,
        'evidence_text_preview':ident['text'][:4000],
        'pdf_metadata':ident['metadata'],
    }


def download(u, dest, attempts=4):
    last=None
    for n in range(attempts):
        try:
            with urlopen(Request(u,headers={'User-Agent':UA}),timeout=120) as r:
                data=r.read()
            dest.write_bytes(data)
            return {'ok':True,'status':'downloaded','attempts':n+1}
        except HTTPError as e:
            last=e
            if e.code in (429, 500, 502, 503, 504) and n < attempts-1:
                retry_after=e.headers.get('Retry-After')
                try: delay=min(60, max(2, int(retry_after))) if retry_after else 2 ** n
                except ValueError: delay=2 ** n
                time.sleep(delay)
                continue
            state='rate_limited' if e.code==429 else 'download_error'
            return {'ok':False,'status':state,'error':f'HTTP {e.code}: {e.reason}','attempts':n+1}
        except Exception as e:
            last=e
            if n < attempts-1:
                time.sleep(2 ** n)
                continue
            return {'ok':False,'status':'download_error','error':str(e),'attempts':n+1}
    return {'ok':False,'status':'download_error','error':str(last)}


def main():
    cat=json.loads(catalog_path.read_text(encoding='utf-8'))
    vault.mkdir(parents=True,exist_ok=True); records=[]
    for book in cat['books']:
        rec={'id':book['id'],'title':book['title'],'author':book.get('author'),'author_death_hijri':book.get('author_death_hijri'),'edition':book.get('edition'),'catalog_rights_status':book.get('rights_status'),'candidates':[]}
        found=False
        for source,discover in sources(book):
            try: urls=links(text(source),source) if discover else [source]
            except HTTPError as e:
                state='rate_limited' if e.code==429 else 'source_error'
                rec['candidates'].append({'source':source,'status':state,'error':f'HTTP {e.code}: {e.reason}'}); continue
            except Exception as e:
                rec['candidates'].append({'source':source,'status':'source_error','error':str(e)}); continue
            if not urls:
                rec['candidates'].append({'source':source,'status':'no_pdf_link'})
                continue
            for u in urls[:20]:
                name=hashlib.sha256(u.encode()).hexdigest()+'.pdf'; dest=vault/(book['id']+'--'+name)
                dl=download(u,dest)
                if not dl['ok']:
                    rec['candidates'].append({'source':source,'url':u,**dl}); continue
                ok,msg=valid(dest)
                item={'source':source,'url':u,'bytes':dest.stat().st_size,'sha256':sha(dest),'validation':{'ok':ok,'output':msg},'download':dl}
                if not ok:
                    item['status']='invalid_pdf'
                    rec['candidates'].append(item)
                    continue
                ident=identity_match(book,dest)
                item['identity']=ident
                if not ident['verified']:
                    # Keep the downloaded candidate for human/developer review;
                    # crucially, do not count it as an acquired book.
                    item['status']=ident['status']
                    item['local_path']=str(dest.relative_to(root))
                    rec['candidates'].append(item)
                    continue
                item['status']='acquired_for_review'; item['local_path']=str(dest.relative_to(root)); rec['candidates'].append(item); rec['acquired']=item; found=True; break
            if found: break
        rec['availability']='copy-acquired' if found else 'not-acquired'
        rec['acquisition_state']='acquired' if found else ('rate-limited' if any(c.get('status')=='rate_limited' for c in rec['candidates']) else ('download-failed' if any(c.get('status')=='download_error' for c in rec['candidates']) else ('identity-unverified' if any(c.get('status') in ('metadata_mismatch','content_identity_unverified') for c in rec['candidates']) else 'global-search-no-match')))
        rec['rights_action']='public-eligible' if found and book.get('rights_status')=='verified-redistributable' else ('developer-vault-encrypt' if found else 'none')
        records.append(rec)
    summary={'schema':'developer-review-acquisition/v2','scope':cat['scope'],'principle':'catalog completeness is independent from redistribution rights; a technically valid PDF is not counted as acquired until bibliographic identity is verified','records':records,'counts':{'books':len(records),'acquired':sum(r['availability']=='copy-acquired' for r in records),'rate_limited':sum(r['acquisition_state']=='rate-limited' for r in records),'identity_unverified':sum(r['acquisition_state']=='identity-unverified' for r in records),'download_failed':sum(r['acquisition_state']=='download-failed' for r in records),'not_found':sum(r['acquisition_state']=='global-search-no-match' for r in records)}}
    out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary['counts'],ensure_ascii=False))
if __name__=='__main__': main()
