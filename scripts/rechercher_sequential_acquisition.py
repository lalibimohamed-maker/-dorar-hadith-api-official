#!/usr/bin/env python3
import argparse,json,os,re,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
STAGES=['Prophet era','Quran','Seerah','Companions','Followers','1-400H','401-800H','801-1200H','1201H','Modern era','Future books']
def text(v): return str(v or '').strip().casefold()
def classify(book,scope=''):
 blob=' '.join(text(book.get(k)) for k in ('target_scope','scope','era','generation','generation_type','category','type'))+' '+text(scope)
 if 'quran' in blob or 'قرآن' in blob or "qur'an" in blob:return 'Quran'
 if any(x in blob for x in ('seerah','sira','سيرة','السيرة')):return 'Seerah'
 if any(x in blob for x in ('prophet era','prophet','نبوي','النبي')):return 'Prophet era'
 if any(x in blob for x in ('companion','companions','sahabi','sahaba','صحابي','صحابة','الصحابة')):return 'Companions'
 if any(x in blob for x in ('follower','followers','tabi',"tabi'in",'تابعي','تابعون','التابعون')):return 'Followers'
 v=book.get('author_death_hijri',book.get('deathYear'))
 try:v=int(v)
 except:v=None
 if v is not None:
  if v<=400:return '1-400H'
  if v<=800:return '401-800H'
  if v<=1200:return '801-1200H'
  return '1201H'
 if any(x in blob for x in ('modern','contemporary','معاصر','حديث')):return 'Modern era'
 return 'Future books'
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--root',default=str(ROOT));a=ap.parse_args();root=Path(a.root).resolve()
 grouped={s:[] for s in STAGES};seen=set()
 for p in sorted((root/'books-batches').glob('**/catalog.json')):
  data=json.loads(p.read_text(encoding='utf-8'))
  for b in data.get('books',[]):
   if not isinstance(b,dict):continue
   k=str(b.get('id') or '').strip() or 'title:'+text(b.get('title') or b.get('titleAr'))
   if k in seen:continue
   seen.add(k);grouped[classify(b,str(p.relative_to(root)))].append(b)
 state_dir=root/'artifacts/governance/sequential-acquisition';state_dir.mkdir(parents=True,exist_ok=True)
 state={'schema':'rechercher-central-sequential-era-engine/v3','order':STAGES,'policy':'one central provider-neutral engine; ordered stages; failures recorded without stopping later stages; verified PDFs resumable; restricted sources are immediately skipped; existing PDFs are re-evaluated when quality policy changes','unique_books':len(seen),'counts':{k:len(v) for k,v in grouped.items()},'completed':[],'failed_stages':[]}
 (state_dir/'queue.json').write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 worker=root/'scripts/rechercher_pdf_acquire.py'
 with tempfile.TemporaryDirectory(prefix='rechercher-sequential-') as td:
  temp=Path(td);(temp/'books-batches').mkdir();(temp/'scripts').symlink_to(root/'scripts',target_is_directory=True);(temp/'artifacts').symlink_to(root/'artifacts',target_is_directory=True)
  for i,stage in enumerate(STAGES,1):
   books=grouped[stage];slug=re.sub(r'[^a-z0-9]+','-',stage.casefold()).strip('-');d=temp/'books-batches'/f'{i:02d}-{slug}';d.mkdir(parents=True,exist_ok=True);(d/'catalog.json').write_text(json.dumps({'books':books},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
   marker=state_dir/f'{i:02d}-{slug}.json'
   if not books: marker.write_text(json.dumps({'stage':stage,'status':'empty','books':0},ensure_ascii=False,indent=2)+'\n',encoding='utf-8');state['completed'].append(stage);continue
   print(f'===== STAGE {i}/{len(STAGES)}: {stage} | {len(books)} books =====',flush=True)
   env=os.environ.copy();env['RECHERCHER_MAX_SOURCE_ATTEMPTS']='24';env['RECHERCHER_REEVALUATE_EXISTING']='1'
   p=subprocess.run(['python3',str(worker),'--root',str(temp)],cwd=root,env=env)
   summary_path=root/'artifacts/acquisition-run-summary.json'
   try: summary=json.loads(summary_path.read_text(encoding='utf-8')) if summary_path.exists() else []
   except Exception: summary=[]
   failed=[x for x in summary if x.get('status') not in ('acquired',)]
   result={'stage':stage,'status':'completed' if p.returncode==0 and not failed else 'partial','books':len(books),'exit_code':p.returncode,'failed_records':len(failed),'quality_re_evaluation':True}
   marker.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
   (state['completed'] if result['status']=='completed' else state['failed_stages']).append(stage);(state_dir/'queue.json').write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 state['finished']=True;(state_dir/'queue.json').write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
if __name__=='__main__':main()
