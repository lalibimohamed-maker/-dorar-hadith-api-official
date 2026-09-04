#!/usr/bin/env python3
import html,json,re,subprocess,shutil
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
def run(c,allow3=False):
 p=subprocess.run(c,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 if p.returncode==0 or (allow3 and p.returncode==3): return p
 raise RuntimeError(p.stdout)
def validate_and_repair(p):
 try:
  q=run(['qpdf','--check',str(p)],allow3=True)
  if q.returncode==0:return {'status':'valid','repaired':False}
  repaired=p.with_suffix('.repaired.pdf')
  run(['qpdf','--replace-input','--object-streams=preserve',str(p)])
  q2=run(['qpdf','--check',str(p)])
  if q2.returncode==0:return {'status':'repaired','repaired':True}
 except Exception:return None
 return None
def candidate_urls(b):
 out=[]
 for s in [b.get('waqfeya_url')]+b.get('sources',[]):
  if not s:continue
  if s.endswith('.pdf'):
   out.append((s,s));continue
  try:
   for u in pdfs(fetch(s),s):out.append((s,u))
  except Exception:continue
 seen=set()
 return [(label,u) for label,u in out if not (u in seen or seen.add(u))]
def acquire_volume(b,n,candidates,work):
 attempts=[]
 for label,u in candidates:
  p=work/f'{n:03d}.pdf'; p.unlink(missing_ok=True)
  try:
   run(['curl','-L','--fail','--retry','5','--retry-delay','2','-o',str(p),u])
   if p.read_bytes()[:4]!=b'%PDF':raise RuntimeError('invalid PDF signature')
   v=validate_and_repair(p)
   if not v:raise RuntimeError('qpdf validation/repair failed')
   sha=subprocess.check_output(['sha256sum',str(p)],text=True).split()[0]
   attempts.append({'source':label,'url':u,'result':'accepted','validation':v})
   return {'volume':n,'source':label,'url':u,'bytes':p.stat().st_size,'sha256':sha,'validation':v,'attempts':attempts}
  except Exception as e:
   attempts.append({'source':label,'url':u,'result':'failed','error':str(e)})
 raise RuntimeError(f"{b['id']} volume {n}: no clean matching source; attempts={json.dumps(attempts,ensure_ascii=False)}")
def acquire(b):
 if b.get('rights_status')!='verified-redistributable':print(f"[HOLD] {b['id']}: rights not verified; metadata only");return
 exp=int(b['expected_volumes']); candidates=candidate_urls(b)
 if not candidates:raise RuntimeError(f"{b['id']}: no source candidates")
 safe=re.sub(r'[^a-z0-9._-]+','-',b['id'].lower()).strip('-'); work=ART/safe
 if work.exists():shutil.rmtree(work)
 work.mkdir(parents=True);vols=[]
 for n in range(1,exp+1):vols.append(acquire_volume(b,n,candidates,work))
 unified=ART/f'{safe}.pdf'; unified.unlink(missing_ok=True)
 pages=[str(work/f'{n:03d}.pdf') for n in range(1,exp+1)]
 run(['qpdf','--empty','--pages',*pages,'--',str(unified)])
 if not validate_and_repair(unified):raise RuntimeError(f'{b["id"]}: unified PDF failed strict validation')
 final_sha=subprocess.check_output(['sha256sum',str(unified)],text=True).split()[0]
 manifest={'id':b['id'],'title':b['title'],'author':b['author'],'edition':b.get('edition'),'expected_volumes':exp,'downloaded_volumes':len(vols),'volumes':vols,'unified_file':str(unified.relative_to(ROOT)),'unified_bytes':unified.stat().st_size,'unified_sha256':final_sha,'policy':'primary -> validate -> repair -> same-edition fallback -> per-volume SHA -> complete ordered unification -> strict unified validation'}
 (ART/f'{safe}.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for b in json.loads(CATALOG.read_text(encoding='utf-8'))['books']:acquire(b)
