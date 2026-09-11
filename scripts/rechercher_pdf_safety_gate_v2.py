#!/usr/bin/env python3
"""Final pre-persistence firewall for acquired Rechercher PDFs.

Important contract: acquisition incompleteness is a retryable queue state, not
an artifact-safety violation. This firewall fails only on unsafe or corrupted
PDF artifacts that were actually acquired for persistence.
"""
import argparse,hashlib,json,re,subprocess,tempfile,unicodedata
from pathlib import Path
ARABIC_DIACRITICS=re.compile(r'[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]')
STOP=set('من في على عن إلى الى و أو او ثم بن ابن أبو ابي أبي ام أم هذا هذه ذلك تلك كتاب كتب جزء مجلد تحقيق شرح دار طبعة الطبعة'.split())
def norm(v):
 s=unicodedata.normalize('NFKC',v or '');s=ARABIC_DIACRITICS.sub('',s).replace('ـ','');s=s.translate(str.maketrans({'أ':'ا','إ':'ا','آ':'ا','ٱ':'ا','ى':'ي','ة':'ه','ؤ':'و','ئ':'ي'}));s=s.lower();s=re.sub(r'[^\w\u0600-\u06ff]+',' ',s,flags=re.UNICODE);return re.sub(r'\s+',' ',s).strip()
def toks(v): return [x for x in norm(v).split() if len(x)>=2 and x not in STOP]
def overlap(a,b): return len(set(a)&set(toks(b)))/max(1,len(set(a)))
def digest(p):
 h=hashlib.sha256();
 with p.open('rb') as f:
  for c in iter(lambda:f.read(1024*1024),b''): h.update(c)
 return h.hexdigest()
def pdf_evidence(p):
 meta='';text='';pages=0
 try:
  r=subprocess.run(['qpdf','--check',str(p)],text=True,capture_output=True)
  if r.returncode!=0:return False,0,'qpdf_failed',''
  r=subprocess.run(['pdfinfo',str(p)],text=True,capture_output=True,timeout=30)
  if r.returncode==0:
   meta=r.stdout
   for line in meta.splitlines():
    if line.lower().startswith('pages:'):
     try:pages=int(line.split(':',1)[1].strip())
     except ValueError:pages=0
  with tempfile.NamedTemporaryFile(suffix='.txt') as tmp:
   r=subprocess.run(['pdftotext','-f','1','-l','8','-layout',str(p),tmp.name],text=True,capture_output=True,timeout=120)
   if r.returncode==0:text=Path(tmp.name).read_text(encoding='utf-8',errors='replace')
 except Exception as e:return False,pages,str(e),meta+'\n'+text
 return True,pages,'',meta+'\n'+text
def prior_index(root,branch,manifest):
 if not branch:return {}
 try:raw=subprocess.check_output(['git','show',f'origin/{branch}:{manifest}'],text=True,stderr=subprocess.DEVNULL);data=json.loads(raw)
 except Exception:return {}
 out={}
 for r in data.get('records',[]):
  rid=str(r.get('id') or '')
  for a in r.get('acquired',[]) or []:
   s=a.get('sha256')
   if s:out.setdefault(s,set()).add(rid)
 return out
def main():
 p=argparse.ArgumentParser();p.add_argument('--root',required=True);p.add_argument('--manifest',required=True);p.add_argument('--catalog',required=True);p.add_argument('--review-branch',required=True);a=p.parse_args();root=Path(a.root).resolve();m=json.loads((root/a.manifest).read_text(encoding='utf-8'));cat=json.loads((root/a.catalog).read_text(encoding='utf-8'));books={str(x.get('id')):x for x in cat.get('books',[]) if x.get('id')};prior=prior_index(root,a.review_branch,a.manifest);sha_ids={};fail=[];checked=0;incomplete=[]
 for r in m.get('records',[]):
  rid=str(r.get('id') or '');b=books.get(rid,r);expected=int(b.get('expected_volumes') or 1);acq=r.get('acquired',[]) or []
  if len(acq)!=expected:incomplete.append({'id':rid,'acquired':len(acq),'expected':expected})
  title=toks(b.get('title',''));author=toks(b.get('author',''))
  for item in acq:
   lp=item.get('local_path');
   if not lp:fail.append(f'{rid}: missing local_path');continue
   f=root/lp
   if not f.exists():fail.append(f'{rid}: missing file {lp}');continue
   checked+=1;ok,pages,err,evidence=pdf_evidence(f)
   if not ok:fail.append(f'{rid}: {err}');continue
   if pages<2:fail.append(f'{rid}: fewer than 2 pages ({pages})')
   ts=max(overlap(title,evidence),0);ascore=max(overlap(author,evidence),1.0 if not author else 0.0)
   if ts < (0.60 if len(set(title))<4 else 0.50):fail.append(f'{rid}: weak PDF title evidence {ts:.3f}')
   if author and ascore<0.50:fail.append(f'{rid}: weak PDF author evidence {ascore:.3f}')
   s=digest(f);expected_sha=item.get('sha256')
   if expected_sha and expected_sha!=s:fail.append(f'{rid}: SHA mismatch manifest={expected_sha} actual={s}')
   sha_ids.setdefault(s,set()).add(rid)
   conflicts=prior.get(s,set())-{rid}
   if conflicts:fail.append(f'{rid}: SHA already belongs to {sorted(conflicts)}')
 for s,ids in sha_ids.items():
  if len(ids)>1:fail.append(f'cross-book SHA collision {s}: {sorted(ids)}')
 print(json.dumps({'schema':'din-allah-encyclopedia/rechercher-pdf-safety-firewall/v2','checked_files':checked,'incomplete_acquisitions':len(incomplete),'incomplete_records':incomplete,'failures':fail},ensure_ascii=False,indent=2))
 if fail:
  print('PDF_SAFETY_FIREWALL=FAIL')
  return 1
 print('PDF_SAFETY_FIREWALL=PASS');return 0
if __name__=='__main__':raise SystemExit(main())
