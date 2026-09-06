#!/usr/bin/env python3
"""Global Control General: fail-closed structural/governance audit."""
import argparse, hashlib, json
from datetime import datetime, timezone
from pathlib import Path

def load(p):
    p=Path(p); return json.loads(p.read_text(encoding='utf-8')) if p.exists() else None

def sha256(p):
    h=hashlib.sha256()
    with open(p,'rb') as f:
        for c in iter(lambda:f.read(1024*1024),b''): h.update(c)
    return h.hexdigest()

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--root',required=True); ap.add_argument('--catalog',required=True); ap.add_argument('--overlay',required=True); ap.add_argument('--governance',required=True); ap.add_argument('--page-integrity',required=True); ap.add_argument('--publication-gate',required=True); ap.add_argument('--deep-worldwide',required=True); ap.add_argument('--out',required=True); a=ap.parse_args()
    root=Path(a.root).resolve(); catalog=load(root/a.catalog) or {}; overlay=load(root/a.overlay) or {}; gov=load(root/a.governance) or {}; pages=load(root/a.page_integrity) or {}; gate=load(root/a.publication_gate) or {}; deep=load(root/a.deep_worldwide) or {}
    books=catalog.get('books',[]); records=gov.get('records',[]); checks=[]; gaps=[]
    def check(name,ok,detail,severity='HIGH'):
        checks.append({'name':name,'status':'PASS' if ok else 'HOLD','severity':severity,'detail':detail})
        if not ok: gaps.append({'check':name,'severity':severity,'detail':detail})
    check('catalog-present',bool(books),f'books={len(books)}','CRITICAL')
    check('overlay-present',bool(overlay.get('entries')),f'entries={len(overlay.get("entries",[]))}','HIGH')
    check('governance-coverage',len(records)>=len(books),f'catalog={len(books)} governance={len(records)}','CRITICAL')
    check('governance-identity-separation',all(r.get('work_id') and r.get('edition_id') or not r.get('edition_id_ready') for r in records), 'Work and Edition IDs are distinct; missing edition remains HOLD','CRITICAL')
    check('quality-score-present',all(r.get('quality_score') is not None for r in records),f'records={len(records)}','HIGH')
    health=overlay.get('engine_health',{}); core={'waqfeya','internet_archive','openlibrary','library_of_congress','google_books','crossref'}
    check('six-core-source-health',not core-set(health),json.dumps({k:v.get('status') for k,v in health.items()},ensure_ascii=False),'HIGH')
    check('deep-worldwide-layer',deep.get('source_count',0)>=10 and deep.get('work_count',0)>=len(books),f'sources={deep.get("source_count",0)} works={deep.get("work_count",0)}','HIGH')
    check('page-integrity-report',bool(pages) and 'counts' in pages,'page integrity report required','HIGH')
    check('publication-gate-report',gate.get('status') in {'PUBLICATION_APPROVED','HOLD'},f'status={gate.get("status")}','CRITICAL')
    vault=root/'artifacts/developer-review-vault'; encrypted=list(vault.glob('*.enc')) if vault.exists() else []
    hashes=[{'name':p.name,'bytes':p.stat().st_size,'sha256':sha256(p)} for p in encrypted]
    check('backup-recovery-policy',(root/'docs/backup-recovery-v1.md').exists(),'recovery policy exists','HIGH')
    for path,name in [('scripts/rechercher_audit_event.py','audit'),('scripts/rechercher_ocr_verify.py','ocr'),('scripts/rechercher_text_collation.py','collation'),('scripts/rechercher_source_delta.py','delta'),('scripts/rechercher_publication_gate.py','publication-gate')]: check(f'{name}-engine',(root/path).exists(),path,'HIGH')
    # Critical rights rule: an acquired candidate may not be promoted merely because a source URL exists.
    inferred=[e.get('id') or e.get('title') for e in overlay.get('entries',[]) if e.get('source_url') and e.get('rights_status') not in {'verified-redistributable','public-domain','source-permitted'}]
    check('no-rights-inference',not inferred,f'candidate URLs without explicit redistributable status={len(inferred)}','CRITICAL')
    result={'schema':'developer-review-acquisition/global-control/v2','generated_at':datetime.now(timezone.utc).isoformat(),'scope':'1-400H','status':'PASS' if not gaps else 'HOLD','counts':{'checks':len(checks),'passed':sum(c['status']=='PASS' for c in checks),'gaps':len(gaps),'encrypted_artifacts':len(encrypted)},'checks':checks,'gaps':gaps,'artifact_hashes':hashes,'policy':'Fail closed; discovery, identity evidence and bibliographic evidence never grant redistribution rights.'}
    out=root/a.out; out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); print(json.dumps(result['counts'],ensure_ascii=False,sort_keys=True))
    raise SystemExit(1 if any(g['severity']=='CRITICAL' for g in gaps) else 0)
if __name__=='__main__': main()
