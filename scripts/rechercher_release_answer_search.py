#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, sqlite3

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--index",required=True)
    ap.add_argument("--query",required=True)
    ap.add_argument("--limit",type=int,default=8)
    a=ap.parse_args()
    db=sqlite3.connect(a.index)
    rows=db.execute("""SELECT p.doc_sha256,p.page,p.text,d.title,d.author,d.repository,d.release_tag,d.asset_name,d.browser_download_url,d.github_asset_digest
                      FROM pages_fts f JOIN pages p ON p.rowid=f.rowid
                      JOIN documents d ON d.sha256=p.doc_sha256
                      WHERE pages_fts MATCH ? ORDER BY bm25(pages_fts) LIMIT ?""",(a.query,a.limit)).fetchall()
    db.close()
    print(json.dumps({"query":a.query,"results":[
      {"sha256":r[0],"page":r[1],"text":r[2],"title":r[3],"author":r[4],"storage_repository":r[5],
       "release_tag":r[6],"asset_name":r[7],"browser_download_url":r[8],"github_asset_digest":r[9]}
      for r in rows]},ensure_ascii=False,indent=2))

if __name__=="__main__": main()
