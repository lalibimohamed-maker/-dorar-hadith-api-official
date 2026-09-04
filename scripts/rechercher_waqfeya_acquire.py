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
 with urlopen(req,timeout=60) as r: return r.read().decode('utf-8','replace')
def pdf_links(page,base):
 out=[]; seen=set()
 for m in re.finditer(r'href=["\\\']([^"\\\']+)["\\\']',page,re.I):
  u=urljoin(base,html.unescape(m.group(1))); u=normalize_url(u)
  if re.search(r'\.pdf(?:\?|$)',u,re.I) and u not in seen:
   seen.add(u); out.append(u)
 return out
def run(cmd): subprocess.run(cmd,check=True)
def acquire(b):
 if b.get('rights_status')!='verified-redistributable':
  print(f"[HOLD] {b['id']}: rights not verified; metadata only")
  return
 exp=int(b['expected_volumes']); page=b['waqfeya_url']; found=pdf_links(fetch(page),page)
 if len(found)<exp: raise SystemExit(f"{b['id']}: found {len(found)} PDFs, expected {exp}")
 found=found[:exp]
 safe=re.sub(r'[^a-z0-9._-]+','-',b['id'].lower()).strip('-')
 work=ART/safe; work.mkdir(parents=True,exist_ok=True); vols=[]
 for n,u in enumerate(found,1):
  p=work/f'{n:03d}.pdf'; print(f'Downloading {b["id"]} {n}/{exp}')
  run(['curl','-L','--fail','--retry','5','--retry-delay','2','-o',str(p),u])
  if p.read_bytes()[:4]!=b'%PDF': raise SystemExit(f'{p}: invalid PDF')
  run(['qpdf','--check',str(p)])
  sha=subprocess.check_output(['sha256sum',str(p)],text=True).split()[0]
  vols.append({'volume':n,'url':u,'bytes':p.stat().st_size,'sha256':sha})
 unified=ART/f'{safe}.pdf'; pages=[str(work/f'{n:03d}.pdf') for n in range(1,exp+1)]
 run(['qpdf','--empty','--pages',*pages,'--',str(unified)]); run(['qpdf','--check',str(unified)])
 final_sha=subprocess.check_output(['sha256sum',str(unified)],text=True).split()[0]
 manifest={'id':b['id'],'title':b['title'],'author':b['author'],'edition':b.get('edition'),'waqfeya_url':page,'expected_volumes':exp,'downloaded_volumes':len(vols),'volumes':vols,'unified_file':str(unified.relative_to(ROOT)),'unified_bytes':unified.stat().st_size,'unified_sha256':final_sha}
 (ART/f'{safe}.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for b in json.loads(CATALOG.read_text(encoding='utf-8'))['books']: acquire(b)
