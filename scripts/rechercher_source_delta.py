#!/usr/bin/env python3
"""Detect meaningful changes between two JSON acquisition snapshots."""
import argparse,json,hashlib
from pathlib import Path
FIELDS=['title','author','edition','source_url','rights_status','sha256','page_count','ocr_quality']
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--old',required=True);ap.add_argument('--new',required=True);ap.add_argument('--out',default='artifacts/governance/source-delta.json');a=ap.parse_args();old=json.loads(Path(a.old).read_text(encoding='utf-8'));new=json.loads(Path(a.new).read_text(encoding='utf-8')); O={x.get('id'):x for x in old.get('entries',old.get('records',[]))};N={x.get('id'):x for x in new.get('entries',new.get('records',[]))};changes=[]
 for k in sorted(set(O)|set(N)):
  if k not in O: changes.append({'id':k,'kind':'added'}); continue
  if k not in N: changes.append({'id':k,'kind':'removed'}); continue
  diff={f:{'old':O[k].get(f),'new':N[k].get(f)} for f in FIELDS if O[k].get(f)!=N[k].get(f)}
  if diff: changes.append({'id':k,'kind':'changed','fields':diff})
 report={'schema':'din-allah-encyclopedia/source-delta/v1','changed':len(changes),'reacquisition_candidates':[x for x in changes if x['kind'] in {'added','changed'}],'changes':changes,'policy':'Only material source/edition/rights/integrity/OCR changes trigger review; deletions never silently erase historical records.'};out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'changed':len(changes)},ensure_ascii=False))
if __name__=='__main__':main()
