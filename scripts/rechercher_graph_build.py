#!/usr/bin/env python3
"""Build deterministic graph layers from catalog metadata without inventing claims."""
import argparse,json,hashlib
from pathlib import Path

def nid(kind,value): return kind+':'+hashlib.sha256(str(value).encode()).hexdigest()[:16]
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--catalog',required=True);ap.add_argument('--out',default='artifacts/governance/knowledge-graph.json');a=ap.parse_args();d=json.loads(Path(a.catalog).read_text(encoding='utf-8'));nodes=[];edges=[]
 for b in d.get('books',[]):
  wid=nid('WORK',b.get('id') or b.get('title'));nodes.append({'id':wid,'type':'WORK','label':b.get('title')})
  if b.get('author'):
   aid=nid('PERSON',b['author']);nodes.append({'id':aid,'type':'PERSON','label':b['author']});edges.append({'from':aid,'to':wid,'type':'AUTHORED'})
  if b.get('edition'):
   eid=nid('EDITION',(b.get('id'),b.get('edition')));nodes.append({'id':eid,'type':'EDITION','label':b.get('edition')});edges.append({'from':wid,'to':eid,'type':'HAS_EDITION'})
  if b.get('source_url'):
   sid=nid('SOURCE',b['source_url']);nodes.append({'id':sid,'type':'SOURCE','label':b['source_url']});edges.append({'from':b.get('id') and wid,'to':sid,'type':'HAS_SOURCE'})
  for topic in b.get('topics',[]) if isinstance(b.get('topics',[]),list) else []:
   tid=nid('TOPIC',topic);nodes.append({'id':tid,'type':'TOPIC','label':topic});edges.append({'from':wid,'to':tid,'type':'ABOUT'})
 # de-duplicate nodes/edges
 nodes=list({n['id']:n for n in nodes}.values());edges=list({(e['from'],e['to'],e['type']):e for e in edges}.values())
 out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps({'schema':'din-allah-encyclopedia/graph/v1','nodes':nodes,'edges':edges,'layers':['edition','citation','knowledge'],'policy':'Only explicit catalog relations are emitted; no inferred scholarly claim is asserted.'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'nodes':len(nodes),'edges':len(edges)},ensure_ascii=False))
if __name__=='__main__':main()
