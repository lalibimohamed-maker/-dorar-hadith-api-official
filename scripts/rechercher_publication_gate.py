#!/usr/bin/env python3
"""Final non-bypassable publication readiness gate."""
import argparse,json
from pathlib import Path

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--governance',required=True);ap.add_argument('--out',default='artifacts/governance/publication-gate.json');a=ap.parse_args();g=json.loads(Path(a.governance).read_text(encoding='utf-8'));approved=[];holds=[]
 for r in g.get('records',[]):
  checks={'identified':r.get('work_id_present'),'edition_ready':r.get('edition_id_ready'),'digital_copy_ready':r.get('digital_copy_id_ready'),'rights_verified':r.get('rights_verified'),'quality_pass':r.get('quality_score',0)>=80}
  ok=all(checks.values()); (approved if ok else holds).append({'work_id':r.get('work_id'),'checks':checks,'state':'PUBLICATION_APPROVED' if ok else 'HOLD'})
 report={'schema':'din-allah-encyclopedia/publication-gate/v1','approved':approved,'holds':holds,'policy':'No publication is approved when any identity, edition, digital-copy, rights or quality requirement is missing.'};out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'approved':len(approved),'hold':len(holds)},ensure_ascii=False))
if __name__=='__main__':main()
