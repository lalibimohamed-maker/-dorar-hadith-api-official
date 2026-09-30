#!/usr/bin/env python3
"""Thin Omega runtime-side adapter for the governed storage unifier.
Only transport parts of the same asset are joined. Independent model shards are preserved.
"""
import argparse,hashlib,json,pathlib,re

def sha256(p):
 h=hashlib.sha256()
 with open(p,"rb") as f:
  for b in iter(lambda:f.read(8*1024*1024),b""): h.update(b)
 return h.hexdigest()

p=argparse.ArgumentParser();p.add_argument("--release-json",required=True);p.add_argument("--download-dir",required=True);p.add_argument("--output-dir",required=True);args=p.parse_args()
d=json.load(open(args.release_json)); out=pathlib.Path(args.output_dir); out.mkdir(parents=True,exist_ok=True); groups={}
for a in d.get("assets",[]):
 m=re.match(r"(.+)\.part-(\d+)$",a["name"])
 if m: groups.setdefault(m.group(1),[]).append((int(m.group(2)),a))
if not groups: raise SystemExit("No transport chunks found")
for base,items in groups.items():
 items.sort()
 if [i for i,_ in items]!=list(range(len(items))): raise SystemExit("Non-contiguous parts: "+base)
 target=out/base; h=hashlib.sha256()
 with open(target,"wb") as dst:
  for _,a in items:
   src=pathlib.Path(args.download_dir)/a["name"]
   if not src.exists(): raise SystemExit("Missing: "+str(src))
   exp=a.get("digest","").removeprefix("sha256:")
   if not exp or sha256(src)!=exp: raise SystemExit("SHA mismatch: "+a["name"])
   with open(src,"rb") as f:
    for b in iter(lambda:f.read(8*1024*1024),b""): dst.write(b); h.update(b)
print(json.dumps({"active":False,"reason":"unified-artifact-ready; runtime smoke test still required","outputs":sorted(str(x) for x in out.iterdir())}))
