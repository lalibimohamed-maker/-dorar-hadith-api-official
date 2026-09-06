#!/usr/bin/env python3
"""Build an acquisition overlay from independent bibliographic/source engines.
Only concrete PDF URLs are emitted as acquisition sources; other engines provide
identity/provenance evidence and never imply redistribution permission."""
import argparse,json,re,html,unicodedata
from pathlib import Path
from urllib.parse import quote,urlencode
from urllib.request import Request,urlopen

UA='DinAllah-Encyclopedia/source-engines/1.0'
DEFAULT_DISCOVERY=['books-batches/salaf-01-400h/master-discovery-additions-2026.json','books-batches/salaf-01-400h/worldwide-deep-research-wave-2026-09.json']

def get(url):
 r=urlopen(Request(url,headers={'User-Agent':UA}),timeout=30); return r.read()
def norm(s): return re.sub(r'[^\w]+',' ',unicodedata.normalize('NFKC',s or '').lower(),flags=re.UNICODE).strip()
def close(a,b):
 a,b=norm(a),norm(b)
 if not a or not b:return False
 A=set(a.split());B=set(b.split());return len(A&B)/max(1,min(len(A),len(B)))>=0.80

def ia_pdf(identifier):
 try:d=json.loads(get('https://archive.org/metadata/'+quote(identifier,safe='')))
 except Exception:return []
 out=[]
 for f in d.get('files',[]):
  n=f.get('name','')
  if n.lower().endswith('.pdf') and not n.lower().endswith(('_text.pdf','_scandata.pdf')):
   out.append('https://archive.org/download/'+quote(identifier,safe='')+'/'+quote(n,safe=''))
 return out[:3]

def archive_search(title,author):
 q=' AND '.join([x for x in [f'title:"{title}"' if title else '',f'creator:"{author}"' if author else ''] if x])
 if not q:return []
 try:d=json.loads(get('https://archive.org/advancedsearch.php?'+urlencode({'q':q,'fl[]':['identifier','title','creator'],'rows':8,'output':'json'})))
 except Exception:return []
 out=[]
 for x in d.get('response',{}).get('docs',[]):
  if close(title,x.get('title','')) and (not author or close(author,' '.join(x.get('creator',[]) if isinstance(x.get('creator'),list) else [x.get('creator','')]))):
   out += ia_pdf(x['identifier'])
 return out

def openlibrary(title,author):
 q=' '.join(x for x in [title,author] if x)
 try:d=json.loads(get('https://openlibrary.org/search.json?'+urlencode({'q':q,'fields':'title,author_name,ia,availability','limit':5})))
 except Exception:return []
 out=[]
 for x in d.get('docs',[]):
  if close(title,x.get('title','')):
   for ident in x.get('ia',[])[:5]:out += ia_pdf(ident)
 return out

def loc(title,author):
 q=' '.join(x for x in [title,author] if x)
 try:d=json.loads(get('https://www.loc.gov/search/?'+urlencode({'q':q,'fo':'json','c':5})))
 except Exception:return []
 return [r.get('id','') for r in d.get('results',[]) if r.get('id')][:5]

def google(title,author):
 q='intitle:'+title+(' inauthor:'+author if author else '')
 try:d=json.loads(get('https://www.googleapis.com/books/v1/volumes?'+urlencode({'q':q,'maxResults':5})))
 except Exception:return []
 return [x.get('id') for x in d.get('items',[]) if close(title,x.get('volumeInfo',{}).get('title',''))][:5]

def crossref(title,author):
 try:d=json.loads(get('https://api.crossref.org/works?'+urlencode({'query.title':title,'query.author':author,'rows':5})))
 except Exception:return []
 return [x.get('DOI') for x in d.get('message',{}).get('items',[]) if x.get('DOI')][:5]

def entries(root,rels):
 out=[]
 for rel in rels:
  p=root/rel
  if not p.exists():continue
  d=json.loads(p.read_text(encoding='utf-8'))
  out += [e for e in d.get('entries',[]) if e.get('title')]
 return out

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--root',required=True);ap.add_argument('--out',default='books-batches/salaf-01-400h/engine-source-overlay.json');ap.add_argument('--discovery',action='append',default=None);a=ap.parse_args();root=Path(a.root).resolve();rels=a.discovery or DEFAULT_DISCOVERY
 records=[]
 for b in entries(root,rels):
  title=b.get('title','');author=b.get('author',''); pdf=[]; evidence={}
  if b.get('waqfeya_url'): evidence['waqfeya']=b['waqfeya_url']
  for u in b.get('sources',[]):
   if isinstance(u,dict) and u.get('url') and re.search(r'\.pdf(?:$|\?)',u['url'],re.I):pdf.append(u['url'])
  try:pdf += archive_search(title,author); evidence['internet_archive']='searched'
  except Exception:pass
  try:pdf += openlibrary(title,author); evidence['openlibrary']='searched'
  except Exception:pass
  try:evidence['library_of_congress']=loc(title,author)
  except Exception:pass
  try:evidence['google_books']=google(title,author)
  except Exception:pass
  try:evidence['crossref']=crossref(title,author)
  except Exception:pass
  seen=[]
  for u in pdf:
   if u not in seen:seen.append(u)
  records.append({'id':b.get('id'),'title':title,'author':author,'author_death_hijri':b.get('author_death_hijri',b.get('death_hijri')),'edition':b.get('edition'),'expected_volumes':b.get('expected_volumes'),'rights_status':b.get('rights_status','discovery-only'),'source_url':seen[0] if seen else None,'sources':[{'url':u,'engine':'internet_archive-or-openlibrary'} for u in seen[:10]],'note':'ENGINE_EVIDENCE '+json.dumps(evidence,ensure_ascii=False,separators=(',',':'))})
 out=root/a.out;out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps({'schema':'developer-review-acquisition/engine-overlay/v1','scope':'1-400H','entries':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'entries':len(records),'concrete_pdf_candidates':sum(bool(x.get('source_url')) for x in records)},ensure_ascii=False))
if __name__=='__main__':main()
