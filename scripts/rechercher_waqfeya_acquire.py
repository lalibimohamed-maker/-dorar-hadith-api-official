#!/usr/bin/env python3
import html, json, re, subprocess
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit, quote
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
CATALOG=ROOT/'books-batches'/'catalog.json'
ART=ROOT/'artifacts'; ART.mkdir(exist_ok=True)

def normalize_url(url):
    p=urlsplit(url)
    return urlunsplit((p.scheme,p.netloc,quote(p.path, safe='/%:@-._~'),p.query,p.fragment))

def fetch(url):
    req=Request(normalize_url(url),headers={'User-Agent':'DinAllah-Encyclopedia/1.0'})
    with urlopen(req,timeout=60) as r:
        return r.read().decode('utf-8','replace')

def pdf_links(page,base):
    out=[]; seen=set()
    for m in re.finditer(r'href=["\\\']([^"\\\']+)["\\\']',page,re.I):
        u=urljoin(base,html.unescape(m.group(1))); u=normalize_url(u)
        if re.search(r'\.pdf(?:\?|$)',u,re.I) and u not in seen:
            seen.add(u); out.append(u)
    return out

def qpdf_check(path):
    """Return (status, output). qpdf status 3 means warnings-only, not fatal errors."""
    p=subprocess.run(['qpdf','--check',str(path)],text=True,capture_output=True)
    return p.returncode, (p.stdout + p.stderr).strip()

def validate_and_repair(path):
    """Validate a PDF before ingest; repair recoverable qpdf warnings, then re-check strictly."""
    status, output=qpdf_check(path)
    if status == 0:
        return {'status':'valid','repaired':False,'initial_check':output,'repair_check':None}
    if status == 2:
        raise SystemExit(f'{path}: qpdf reported PDF errors:\n{output}')
    if status != 3:
        raise SystemExit(f'{path}: qpdf check failed with unexpected exit {status}:\n{output}')

    # qpdf documents exit 3 as warnings without errors. Rewrite through qpdf so
    # recoverable structural defects are repaired before anything is committed.
    original=path.with_name(path.name + '.pre-repair')
    path.rename(original)
    try:
        repair=subprocess.run(
            ['qpdf',str(original),'--replace-input'],
            text=True,capture_output=True
        )
        if repair.returncode not in (0,3):
            raise SystemExit(f'{path}: qpdf repair failed with exit {repair.returncode}:\n{repair.stdout}\n{repair.stderr}')
        # qpdf --replace-input keeps the repaired file at the original filename.
        status2, output2=qpdf_check(original)
        if status2 == 0:
            # Move the repaired file back to its canonical path.
            original.rename(path)
            return {'status':'repaired','repaired':True,'initial_check':output,'repair_check':output2}
        # If qpdf still reports warnings/errors after repair, do not ingest it.
        raise SystemExit(f'{path}: PDF remains structurally non-clean after repair (exit {status2}):\n{output2}')
    except Exception:
        if not path.exists() and original.exists():
            original.rename(path)
        raise

def sha256(path):
    return subprocess.check_output(['sha256sum',str(path)],text=True).split()[0]

def run(cmd):
    subprocess.run(cmd,check=True)

def acquire(b):
    if b.get('rights_status')!='verified-redistributable':
        print(f"[HOLD] {b['id']}: rights not verified; metadata only")
        return
    exp=int(b['expected_volumes']); page=b['waqfeya_url']; found=pdf_links(fetch(page),page)
    if len(found)<exp:
        raise SystemExit(f"{b['id']}: found {len(found)} PDFs, expected {exp}")
    found=found[:exp]
    safe=re.sub(r'[^a-z0-9._-]+','-',b['id'].lower()).strip('-')
    work=ART/safe; work.mkdir(parents=True,exist_ok=True); vols=[]
    for n,u in enumerate(found,1):
        p=work/f'{n:03d}.pdf'
        print(f'Downloading {b["id"]} {n}/{exp}')
        run(['curl','-L','--fail','--retry','5','--retry-delay','2','-o',str(p),u])
        if p.read_bytes()[:4]!=b'%PDF':
            raise SystemExit(f'{p}: invalid PDF signature')
        validation=validate_and_repair(p)
        vols.append({
            'volume':n,
            'url':u,
            'bytes':p.stat().st_size,
            'sha256':sha256(p),
            'validation':validation,
        })

    unified=ART/f'{safe}.pdf'
    pages=[str(work/f'{n:03d}.pdf') for n in range(1,exp+1)]
    run(['qpdf','--empty','--pages',*pages,'--',str(unified)])
    unified_validation=validate_and_repair(unified)
    final_sha=sha256(unified)
    manifest={
        'id':b['id'],'title':b['title'],'author':b['author'],'edition':b.get('edition'),
        'waqfeya_url':page,'expected_volumes':exp,'downloaded_volumes':len(vols),
        'volumes':vols,'unified_file':str(unified.relative_to(ROOT)),
        'unified_bytes':unified.stat().st_size,'unified_sha256':final_sha,
        'unified_validation':unified_validation,
        'ingest_policy':'validate each PDF; repair recoverable qpdf warnings; reject errors; unify only after all volumes pass',
    }
    (ART/f'{safe}.manifest.json').write_text(
        json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'
    )

for b in json.loads(CATALOG.read_text(encoding='utf-8'))['books']:
    acquire(b)
