#!/usr/bin/env python3
import json, re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
STAGE_ORDER = {'Prophet era':0,'Quran':1,'Seerah':2,'Companions':3,'Followers':4,'1-400H':5,'401-800H':6,'801-1200H':7,'1201H':8,'Modern era':9,'Future books':10}

def text(v): return str(v or '').strip().casefold()
def stage(m):
    s = text(m.get('era') or m.get('classified_era') or m.get('target_scope'))
    for name in STAGE_ORDER:
        if text(name) in s: return name
    return 'Future books'
def hijri(m):
    v = m.get('author_death_hijri', m.get('deathYear'))
    try: return int(v)
    except (TypeError, ValueError): return 999999

records=[]
for path in sorted((ROOT/'artifacts').glob('*.manifest.json')):
    try:
        m=json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        continue
    if not m.get('unified_sha256') or m.get('pdf') != 'real+validated': continue
    records.append({'id':m.get('id'),'title':m.get('title'),'author':m.get('author'),'era':stage(m),'author_death_hijri':hijri(m) if hijri(m)!=999999 else None,'sha256':m['unified_sha256'],'file':m.get('unified_file')})
records.sort(key=lambda r:(STAGE_ORDER.get(r['era'],10), r['author_death_hijri'] if r['author_death_hijri'] is not None else 999999, text(r['title'])))
for n,r in enumerate(records,1): r['sequence']=n; r['sequence_label']=f'{n:06d}-H{r["author_death_hijri"] if r["author_death_hijri"] is not None else "UNKNOWN"}'
out=ROOT/'artifacts/governance/chronological-book-index.json'; out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps({'schema':'rechercher-chronological-book-index/v1','order':['Prophet era','Quran','Seerah','Companions','Followers','1-400H','401-800H','801-1200H','1201H','Modern era','Future books'],'count':len(records),'records':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'chronological index: {len(records)} verified real PDFs')
