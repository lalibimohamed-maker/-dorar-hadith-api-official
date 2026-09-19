#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json, os, sqlite3, tempfile
from pathlib import Path
from urllib.request import Request, urlopen

def gh_json(url: str, token: str | None):
    req=Request(url, headers={"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2026-03-10"})
    if token: req.add_header("Authorization", f"Bearer {token}")
    with urlopen(req, timeout=60) as r: return json.load(r)

def download(url: str, out: Path, token: str | None):
    req=Request(url, headers={"Accept":"application/octet-stream","User-Agent":"DinAllah-Rechercher"})
    if token: req.add_header("Authorization", f"Bearer {token}")
    with urlopen(req, timeout=180) as r, out.open("wb") as f:
        while True:
            b=r.read(1024*1024)
            if not b: break
            f.write(b)

def sha256(p: Path):
    h=hashlib.sha256()
    with p.open("rb") as f:
        for b in iter(lambda:f.read(1024*1024),b""): h.update(b)
    return h.hexdigest()

def extract_pages(pdf: Path):
    import fitz
    doc=fitz.open(pdf)
    for n,page in enumerate(doc,1):
        yield n, page.get_text("text") or ""

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--shards",required=True)
    ap.add_argument("--out",default="artifacts/governance/rechercher-release-answer-index.sqlite")
    ap.add_argument("--manifest",default="artifacts/governance/rechercher-release-answer-index.json")
    ap.add_argument("--max-asset-mib",type=int,default=2048)
    a=ap.parse_args()
    shards=json.loads(Path(a.shards).read_text())["repositories"]
    token=os.environ.get("GH_TOKEN")
    out=Path(a.out); out.parent.mkdir(parents=True,exist_ok=True)
    db=sqlite3.connect(out)
    db.executescript("""PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS documents(sha256 TEXT PRIMARY KEY,repository TEXT,release_tag TEXT,asset_id INTEGER,asset_name TEXT,title TEXT,author TEXT,size INTEGER,browser_download_url TEXT,github_asset_digest TEXT,verification_status TEXT);
CREATE TABLE IF NOT EXISTS pages(doc_sha256 TEXT,page INTEGER,text TEXT,PRIMARY KEY(doc_sha256,page));
CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(doc_sha256 UNINDEXED,page UNINDEXED,text,content='pages',content_rowid='rowid');
""")
    assets_seen=pages_seen=docs_seen=0
    with tempfile.TemporaryDirectory() as td:
        tmp=Path(td)
        for repo in sorted(set(shards)):
            releases=gh_json(f"https://api.github.com/repos/{repo}/releases?per_page=100",token)
            for rel in releases:
                if rel.get("draft") or rel.get("prerelease"): continue
                for asset in rel.get("assets",[]):
                    if not asset.get("name","").lower().endswith(".pdf"): continue
                    if asset.get("size",0)>a.max_asset_mib*1024*1024: continue
                    assets_seen+=1
                    dest=tmp/f"{asset['id']}.pdf"
                    download(asset["browser_download_url"],dest,token)
                    digest=sha256(dest)
                    expected=(asset.get("digest") or "").removeprefix("sha256:")
                    if expected and digest!=expected: raise SystemExit(f"SHA-256 mismatch for {repo}/{asset['name']}")
                    with dest.open("rb") as f:
                        if f.read(5)!=b"%PDF-": raise SystemExit(f"Invalid PDF signature: {repo}/{asset['name']}")
                    pages=list(extract_pages(dest))
                    db.execute("INSERT OR REPLACE INTO documents VALUES(?,?,?,?,?,?,?,?,?,?,?)",(digest,repo,rel["tag_name"],asset["id"],asset["name"],asset["name"].rsplit("--",1)[0],None,asset["size"],asset["browser_download_url"],asset.get("digest"),"pdf-signature-sha256-text-extracted"))
                    db.execute("DELETE FROM pages WHERE doc_sha256=?",(digest,))
                    db.executemany("INSERT INTO pages(doc_sha256,page,text) VALUES(?,?,?)",[(digest,n,t) for n,t in pages if t.strip()])
                    db.execute("DELETE FROM pages_fts WHERE doc_sha256=?",(digest,))
                    db.execute("INSERT INTO pages_fts(rowid,doc_sha256,page,text) SELECT rowid,doc_sha256,page,text FROM pages WHERE doc_sha256=?",(digest,))
                    docs_seen+=1; pages_seen+=sum(bool(t.strip()) for _,t in pages)
    db.commit(); db.close()
    Path(a.manifest).write_text(json.dumps({"schema":"din-allah/rechercher-release-answer-index/v1","source":"public GitHub Release PDF assets","documents_indexed":docs_seen,"pages_indexed":pages_seen,"pdf_assets_seen":assets_seen,"index_path":a.out,"search":"SQLite FTS5 page-aware full-text retrieval"},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"RELEASE_PDF_ASSETS_SEEN={assets_seen}")
    print(f"RELEASE_PDF_DOCUMENTS_INDEXED={docs_seen}")
    print(f"RELEASE_PDF_PAGES_INDEXED={pages_seen}")
    print("RELEASE_PDF_ANSWER_INDEX=READY")

if __name__=="__main__": main()
