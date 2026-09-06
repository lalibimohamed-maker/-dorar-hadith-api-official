#!/usr/bin/env python3
"""Compare two text representations and emit reviewable differences.
This is a gate, not an automatic choice of which edition is correct.
"""
import argparse,difflib,hashlib,json,re
from pathlib import Path

def norm(s):
 s=re.sub(r'[\u064B-\u065F\u0670]','',s.replace('\u0640',''))
 return re.sub(r'\s+',' ',s).strip()
def sha(s): return hashlib.sha256(s.encode('utf-8')).hexdigest()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--left',required=True);ap.add_argument('--right',required=True);ap.add_argument('--out',default='artifacts/governance/collation.json');a=ap.parse_args();L=norm(Path(a.left).read_text(encoding='utf-8'));R=norm(Path(a.right).read_text(encoding='utf-8')); sm=difflib.SequenceMatcher(None,L,R); ratio=sm.ratio(); ops=[{'tag':t,'left':L[i1:i2],'right':R[j1:j2]} for t,i1,i2,j1,j2 in sm.get_opcodes() if t!='equal'][:500]; state='PASS' if ratio>=.995 else ('REVIEW' if ratio>=.97 else 'HOLD'); report={'schema':'din-allah-encyclopedia/text-collation/v1','left_sha256':sha(L),'right_sha256':sha(R),'similarity':round(ratio,6),'differences':ops,'state':state,'policy':'Differences are preserved for scholarly review; the engine never selects a preferred reading automatically.'};out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'similarity':round(ratio,6),'state':state},ensure_ascii=False));
if __name__=='__main__':main()
