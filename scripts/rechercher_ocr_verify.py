#!/usr/bin/env python3
"""Verify OCR manifests conservatively; OCR never becomes authoritative by itself.
Expected JSON: {source_sha256, engine_version, pages:[{page,confidence,text_sha256}]}.
"""
import argparse,json
from pathlib import Path

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--manifest',required=True);ap.add_argument('--out',default='artifacts/governance/ocr-verification.json');a=ap.parse_args();d=json.loads(Path(a.manifest).read_text(encoding='utf-8')); pages=d.get('pages',[]); low=[p for p in pages if float(p.get('confidence',0))<.90]; failed=[p for p in pages if not p.get('text_sha256')]; score=sum(float(p.get('confidence',0)) for p in pages)/len(pages) if pages else 0; state='TEXT_VERIFIED' if pages and not low and not failed and score>=.97 else ('REVIEW' if pages else 'HOLD'); report={'schema':'din-allah-encyclopedia/ocr-verification/v1','source_sha256':d.get('source_sha256'),'engine_version':d.get('engine_version'),'pages':len(pages),'mean_confidence':round(score,4),'low_confidence_pages':[p.get('page') for p in low],'missing_text_hash_pages':[p.get('page') for p in failed],'state':state,'ocr_is_authoritative':False};out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'pages':len(pages),'mean_confidence':round(score,4),'state':state},ensure_ascii=False));
 if state!='TEXT_VERIFIED': raise SystemExit(2)
if __name__=='__main__':main()
