#!/usr/bin/env python3
"""Build an auditable, uncapped bibliographic census for 1-400 AH.

Discovery/census only: it never treats one corpus as exhaustive and never
silently merges uncertain title variants. OpenITI is a machine-readable
baseline; existing Rechercher discovery waves are unioned in.
"""
import argparse,csv,hashlib,json,re,time,unicodedata
from pathlib import Path
from urllib.request import Request,urlopen

OPENITI_METADATA='https://raw.githubusercontent.com/OpenITI/RELEASE/master/metadata/OpenITI_metadata_2025-1-9.tsv'
DISCOVERY_DEFAULTS=['books-batches/salaf-01-400h/catalog.json','books-batches/salaf-01-400h/master-discovery-additions-2026.json','books-batches/salaf-01-400h/worldwide-deep-research-wave-2026-09.json']
DIAC=re.compile(r'[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]'); SPACE=re.compile(r'\s+')

def norm(v):
    v=unicodedata.normalize('NFKC',str(v or '')).strip().lower(); v=DIAC.sub('',v).replace('ـ','')
    v=v.replace('أ','ا').replace('إ','ا').replace('آ','ا').replace('ى','ي').replace('ة','ه')
    return SPACE.sub(' ',re.sub(r'[^\w\u0600-\u06ff]+',' ',v,flags=re.UNICODE)).strip()

def load(p): return json.loads(p.read_text(encoding='utf-8'))
def fetch(url):
    req=Request(url,headers={'User-Agent':'DinAllah-Encyclopedia/Rechercher-Master-Census/1.0'})
    with urlopen(req,timeout=180) as r:return r.read()
def first(headers,terms):
    for h in headers:
        x=norm(h)
        if all(t in x for t in terms): return h
    return None
def death(uri,value=''):
    m=re.match(r'^(\d{1,4})',str(uri or ''))
    if m:return int(m.group(1))
    m=re.search(r'(\d{1,4})\s*(?:AH|hijri|هـ)',str(value or ''),re.I)
    return int(m.group(1)) if m else None

def add(records,title,author,death_hijri,source_type,source_file,source_id='',status='unverified'):
    title=str(title or '').strip(); author=str(author or '').strip()
    if not title:return
    tn,an=norm(title),norm(author); key=hashlib.sha256((an+'|'+tn).encode()).hexdigest()[:24]
    if key not in records:
        records[key]={'title':title,'author':author,'author_death_hijri':death_hijri,'source_type':source_type,'source_file':source_file,'source_id':source_id,'survival_status':status,'verification_status':'discovery_only'}
    else:
        old=records[key]
        old.setdefault('additional_sources',[]).append({'source_type':source_type,'source_file':source_file,'source_id':source_id})

def ingest_discovery(root,path,records):
    p=root/path
    if not p.exists():return 0
    d=load(p); entries=d.get('entries',[]) if isinstance(d,dict) else []; n=0
    for b in entries:
        dh=b.get('author_death_hijri',b.get('death_hijri'))
        try: dh=int(dh) if dh is not None else None
        except: dh=None
        if dh is not None and not 1<=dh<=400:continue
        add(records,b.get('title'),b.get('author'),dh,'rechercher_discovery',path,b.get('id') or b.get('work_id'),b.get('status','unverified')); n+=1
    return n

def ingest_openiti(records):
    raw=fetch(OPENITI_METADATA); text=raw.decode('utf-8-sig','replace'); reader=csv.DictReader(text.splitlines(),delimiter='\t'); headers=reader.fieldnames or []
    uri_key=first(headers,['book','uri']) or first(headers,['book','id']); title_key=first(headers,['title']); author_key=first(headers,['author']); death_key=first(headers,['death'])
    if not title_key: raise RuntimeError('OpenITI metadata title column not found')
    n=0
    for row in reader:
        uri=row.get(uri_key,'') if uri_key else ''; dh=death(uri,row.get(death_key,'') if death_key else '')
        if dh is None or not 1<=dh<=400:continue
        title=row.get(title_key,''); author=row.get(author_key,'') if author_key else ''
        if title:add(records,title,author,dh,'openiti_release_metadata','OpenITI/RELEASE metadata/OpenITI_metadata_2025-1-9.tsv',uri,'digital_text_in_openiti'); n+=1
    return n,len(raw),headers

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--root',required=True); ap.add_argument('--out',default='books-batches/salaf-01-400h/master-census-1-400h.json'); ap.add_argument('--tsv',default='books-batches/salaf-01-400h/master-census-1-400h.tsv'); ap.add_argument('--discovery',action='append'); a=ap.parse_args(); root=Path(a.root).resolve(); records={}
    paths=a.discovery or DISCOVERY_DEFAULTS; dc={p:ingest_discovery(root,p,records) for p in paths}; oc,obytes,headers=ingest_openiti(records)
    rows=sorted(records.values(),key=lambda r:(r.get('author_death_hijri') is None,r.get('author_death_hijri') or 9999,norm(r.get('author','')),norm(r.get('title',''))))
    for i,r in enumerate(rows,1):
        r.update({'census_id':f'salaf01-400h-{i:06d}','scope':'1-400H','rights_status':'unknown_until_verified','acquisition_status':'not_attempted','ocr_status':'not_applicable_until_witness_found'})
    report={'schema':'rechercher/master-census-1-400h/v1','generated_at_epoch':int(time.time()),'scope':'1-400H','uncapped':True,'records':rows,'counts':{'unique_work_identity_records':len(rows),'openiti_rows_considered':oc,'discovery_rows_considered':sum(dc.values()),'with_author_death_hijri':sum(r.get('author_death_hijri') is not None for r in rows),'with_digital_witness_in_openiti':sum(r.get('source_type')=='openiti_release_metadata' for r in rows)},'discovery_counts':dc,'baseline':{'openiti_metadata_url':OPENITI_METADATA,'openiti_metadata_bytes':obytes,'openiti_metadata_columns':headers},'source_policy':{'OpenITI':'baseline digital-corpus evidence; not exhaustive','Fihrist Ibn al-Nadim':'independent historical bibliography; must be reconciled, not treated as exhaustive','Fihrist.org':'manuscript-catalogue evidence; distinct from Ibn al-Nadim\'s Fihrist','GAS/GAL and specialist bibliographies':'independent bibliographic evidence to be reconciled','institutional_catalogues':'manuscript witness discovery; rights/access remain separate'},'deduplication_policy':'exact normalized author+title only; uncertain title variants are retained for scholarly reconciliation','rights_policy':'discovery never implies redistribution permission','warning':'Living auditable union; not declared historically exhaustive until independent bibliographic families and manuscript catalogues are reconciled.'}
    out=root/a.out; out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    tsv=root/a.tsv; fields=['census_id','author_death_hijri','author','title','source_type','source_file','source_id','survival_status','verification_status','rights_status','acquisition_status','ocr_status']
    with tsv.open('w',encoding='utf-8',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields,delimiter='\t',extrasaction='ignore'); w.writeheader(); w.writerows(rows)
    print(json.dumps(report['counts'],ensure_ascii=False,sort_keys=True))
if __name__=='__main__':main()
