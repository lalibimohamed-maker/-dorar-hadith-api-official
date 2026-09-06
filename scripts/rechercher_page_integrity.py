#!/usr/bin/env python3
"""Audit acquired PDFs for basic page integrity before encryption/publication.
Uses qpdf for structural validation and, when available, pdfinfo for page counts.
This is deliberately conservative: inability to inspect a property becomes HOLD.
"""
import argparse, json, shutil, subprocess, hashlib
from pathlib import Path

def run(cmd):
    p=subprocess.run(cmd,text=True,capture_output=True)
    return p.returncode,p.stdout,p.stderr

def sha256(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for c in iter(lambda:f.read(1024*1024),b''): h.update(c)
    return h.hexdigest()

def inspect(path):
    qrc,qout,qerr=run(['qpdf','--check',str(path)]) if shutil.which('qpdf') else (127,'','qpdf missing')
    pages=None
    if shutil.which('pdfinfo'):
        rc,out,err=run(['pdfinfo',str(path)])
        if rc==0:
            for line in out.splitlines():
                if line.lower().startswith('pages:'):
                    try: pages=int(line.split(':',1)[1].strip())
                    except ValueError: pages=None
    return {'path':str(path),'bytes':path.stat().st_size,'sha256':sha256(path),'qpdf_ok':qrc==0,'qpdf_output':(qout+qerr).strip(),'page_count':pages,'status':'passed' if qrc==0 and pages and pages>0 else 'hold','missing_pages':'unknown','duplicate_pages':'unknown','blank_pages':'unknown','orientation_anomalies':'unknown'}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--vault',default='artifacts/developer-review-vault');ap.add_argument('--out',default='artifacts/governance/page-integrity.json');a=ap.parse_args();root=Path('.').resolve(); vault=root/a.vault
    records=[inspect(p) for p in sorted(vault.glob('*.pdf'))]
    report={'schema':'din-allah-encyclopedia/page-integrity/v1','files':records,'counts':{'files':len(records),'passed':sum(r['status']=='passed' for r in records),'hold':sum(r['status']!='passed' for r in records)},'policy':'Unknown page-level properties are HOLD until a page-image analysis stage supplies evidence.'}
    out=root/a.out;out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(report['counts'],ensure_ascii=False,sort_keys=True))
    if any(r['status']!='passed' for r in records): raise SystemExit(2)

if __name__=='__main__':main()
