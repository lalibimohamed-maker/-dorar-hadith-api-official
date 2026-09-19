#!/usr/bin/env python3
from __future__ import annotations
import argparse,hashlib,json
from pathlib import Path
SHARDS=["lalibimohamed-maker/dinullah-pdf-storage-01","lalibimohamed-maker/dinullah-pdf-storage-02","lalibimohamed-maker/dinullah-pdf-storage-03"]
def sha256(p):
 h=hashlib.sha256()
 with p.open("rb") as f:
  for c in iter(lambda:f.read(1048576),b""): h.update(c)
 return h.hexdigest()
def allowed(r): return r.get("rights_status")=="verified-redistributable" or r.get("redistribution_status")=="verified-redistributable" or r.get("catalog_rights_status")=="verified-redistributable"
def shard(d): return SHARDS[int(d[0],16)%len(SHARDS)]
def main():
 ap=argparse.ArgumentParser(); ap.add_argument("--root",default="."); ap.add_argument("--manifest",required=True); ap.add_argument("--out",default="artifacts/governance/federated-release-storage-plan.json"); a=ap.parse_args(); root=Path(a.root)
 s=json.loads((root/a.manifest).read_text(encoding="utf-8")); recs=(s.get("records") if isinstance(s,dict) else s) or []; by={}; skipped=[]
 for r in recs:
  if not allowed(r): skipped.append({"book_id":r.get("book_id") or r.get("work_id"),"reason":"rights-not-verified-redistributable"}); continue
  for it in r.get("acquired") or []:
   local=it.get("local_path")
   if not local: continue
   p=root/local
   if not p.exists() or p.suffix.lower()!=".pdf": skipped.append({"book_id":r.get("book_id") or r.get("work_id"),"reason":"missing-pdf","path":local}); continue
   with p.open("rb") as f:
    if f.read(5)!=b"%PDF-": skipped.append({"book_id":r.get("book_id") or r.get("work_id"),"reason":"invalid-pdf","path":local}); continue
   d=sha256(p)
   if d in by: skipped.append({"book_id":r.get("book_id") or r.get("work_id"),"reason":"duplicate-sha256","sha256":d}); continue
   bid=r.get("book_id") or r.get("work_id") or p.stem
   by[d]={"book_id":bid,"title":r.get("title"),"author":r.get("author"),"edition":r.get("edition"),"rights_status":r.get("rights_status") or r.get("catalog_rights_status"),"rights_source":r.get("rights_source"),"rights_evidence":r.get("rights_evidence"),"provenance":r.get("provenance") or r.get("source_url") or r.get("sources"),"sha256":d,"size":p.stat().st_size,"local_path":str(p.relative_to(root)),"storage_repository":shard(d),"asset_name":f"{bid}--{d[:16]}.pdf","verification_status":"pdf-signature-and-sha256-verified"}
 out=root/a.out; out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps({"schema":"din-allah/rechercher-federated-release-storage-plan/v1","candidate_count":len(by),"skipped_count":len(skipped),"candidates":sorted(by.values(),key=lambda x:(x["storage_repository"],x["sha256"])),"skipped":skipped},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(f"FEDERATED_RELEASE_PLAN_CANDIDATES={len(by)}"); print(f"FEDERATED_RELEASE_PLAN_SKIPPED={len(skipped)}"); print("FEDERATED_RELEASE_RIGHTS_GATE=ENFORCED"); print("FEDERATED_RELEASE_CORPUS_MUTATION=NONE")
if __name__=="__main__": main()
