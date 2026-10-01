#!/usr/bin/env python3
"""Resolve Rechercher PDF persistence to GitHub Releases, never Git LFS."""
from __future__ import annotations
import argparse, json
from pathlib import Path

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--root',default='.')
    ap.add_argument('--config',default='config/rechercher-permanent-storage-pool.json')
    ap.add_argument('--output',default='artifacts/governance/storage-pool-route.json')
    args=ap.parse_args()
    root=Path(args.root).resolve()
    cfg=json.loads((root/args.config).read_text(encoding='utf-8'))
    if cfg.get('backend')!='github-releases-assets': raise SystemExit('ERROR: PDF storage backend is not GitHub Releases')
    if cfg.get('git_lfs') is not False: raise SystemExit('ERROR: Git LFS must be disabled for PDF storage')
    if cfg.get('github_actions_artifacts_as_pdf_storage') is not False: raise SystemExit('ERROR: Actions artifacts cannot be PDF storage')
    if cfg.get('encrypted_final_artifacts') is not False: raise SystemExit('ERROR: encrypted final PDFs are forbidden')
    out={
      'schema':'din-allah-encyclopedia/permanent-storage-pool-route/v2',
      'storage_backend':'github-releases-assets',
      'public_repository':cfg['primary']['repository'],
      'protected_repository':cfg['protected']['repository'],
      'git_lfs':False,
      'release_assets':True,
      'repository_tree_pdfs':False,
      'policy':'real .pdf Releases assets only; indexes/manifests in repository tree'
    }
    p=root/args.output
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(out,ensure_ascii=False))

if __name__=='__main__': raise SystemExit(main())
