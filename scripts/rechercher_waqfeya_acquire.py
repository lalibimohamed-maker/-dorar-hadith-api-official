#!/usr/bin/env python3
import html,json,re,subprocess
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request,urlopen
ROOT=Path(__file__).resolve().parents[1]; CATALOG=ROOT/'books-batches'/'catalog.json'; ART=ROOT/'artifacts'; ART.mkdir(exist_ok=True)
def fetch(u):
 with urlopen(Request(u,headers={'User-Agent':'DinAllah-Encyclopedia/1.0'}),timeout=60) as r:return r.read().decode('utf-8','replace')
def pdfs(page,base):
 out=[];seen=set()
 for m in re.finditer(r'href=["\\\']([^"\\\']+)["\\\']',page,re.I):
  u=urljoin(base,html.unescape(m.group(1)))
  if re.search(r'\.pdf(?:\?|$)',u,re.I) and u not in seen:seen.add(u);out.append(u)
 return out
def run(c):subprocess.run(c,check=True)
def acquire(b):
 if b.get('rights_status')!='verified-redistributable': print(f"[HOLD] {b['id']}: rights not verified; metadata only"); return
 exp=int(b['expected_volumes']); links=pdfs(fetch(b['waqfeya_url']),b['waqfeya_url'])
 if len(links)<exp:raise SystemExit(f"{b['id']}: found {len(links)} PDFs, expected {exp}")
 links=links[:exp]; safe=re.sub(r'[^a-z0-9._-]+','-',b['id'].lower()).strip('-'); work=ART/safe; work.mkdir(parents=True,exist_ok=True); vols=[]
 for n,u in enumerate(links,1):
  p=work/f'{n:03d}.pdf'; run(['curl','-L','--fail','--retry','5','--retry-delay','2','-o',str(p),u])
  if p.read_bytes()[:4]!=b'%PDF':raise SystemExit(f'{p}: invalid PDF')
  run(['qpdf','--check',str(p)]); sha=subprocess.check_output(['sha256sum',str(p)],text=True).split()[0]
  vols.append({'volume':n,'url':u,'bytes':p.stat().st_size,'sha256':sha})
 unified=ART/f'{safe}.pdf'; pages=[str(work/f'{n:03d}.pdf') for n in range(1,exp+1)]; run(['qpdf','--empty','--pages',*pages,'--',str(unified)]); run(['qpdf','--check',str(unified)]); final_sha=subprocess.check_output(['sha256sum',str(unified)],text=True).split()[0]
 (ART/f'{safe}.manifest.json').write_text(json.dumps({'id':b['id'],'title':b['title'],'author':b['author'],'edition':b.get('edition'),'waqfeya_url':b['waqfeya_url'],'expected_volumes':exp,'downloaded_volumes':len(vols),'volumes':vols,'unified_file':str(unified.relative_to(ROOT)),'unified_bytes':unified.stat().st_size,'unified_sha256':final_sha},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for b in json.loads(CATALOG.read_text(encoding='utf-8'))['books']:acquire(b)
