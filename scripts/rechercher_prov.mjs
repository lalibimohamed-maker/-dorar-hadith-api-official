#!/usr/bin/env node
import fs from 'node:fs/promises';

export const PROV_NS='http://www.w3.org/ns/prov#';
export const DIN_NS='urn:dinullah:';

const clean=s=>String(s??'').replace(/[^A-Za-z0-9._:-]+/g,'-').replace(/^-+|-+$/g,'')||'unknown';

export function createProvDocument({runId='local',tool='DinAllah-Rechercher'}={}){
  const doc={
    prefix:{prov:PROV_NS,din:DIN_NS},
    entity:{},
    activity:{},
    agent:{
      'din:agent:rechercher':{
        'prov:type':'prov:Agent',
        'prov:label':'DinAllah-Rechercher',
        'din:tool':tool
      }
    },
    used:{},
    wasGeneratedBy:{},
    wasAssociatedWith:{},
    hadPrimarySource:{},
    wasDerivedFrom:{}
  };
  doc['din:run_id']=String(runId);
  return doc;
}

function ensureMap(doc,key){if(!doc[key])doc[key]={};return doc[key];}

export function recordAcquisition(doc, info){
  const runId=clean(info.runId||doc['din:run_id']||'local');
  const sha=String(info.sha256||'').toLowerCase();
  if(!/^[a-f0-9]{64}$/.test(sha)) throw new Error('invalid SHA-256 for provenance');
  const stamp=new Date(info.acquiredAt||Date.now()).toISOString();
  const cell=clean(info.cellId);
  const source=clean(info.sourceId);
  const activityId=`din:activity:${runId}:acquisition:${cell}:${sha.slice(0,16)}`;
  const outputId=`din:entity:pdf:sha256:${sha}`;
  const sourceId=`din:entity:source:${source}:${clean(info.sourceUrl)}`;
  const activity=ensureMap(doc,'activity'),entity=ensureMap(doc,'entity'),agent=ensureMap(doc,'agent');
  const sourceAgentId=`din:agent:source:${source}`;
  agent[sourceAgentId]={
    'prov:type':'prov:Organization',
    'prov:label':String(info.sourceLabel||info.sourceId)
  };
  activity[activityId]={
    'prov:type':'din:Acquisition',
    'prov:startTime':stamp,
    'prov:endTime':stamp,
    'din:cell_id':String(info.cellId),
    'din:source_id':String(info.sourceId),
    'din:run_id':runId,
    'din:tool':String(info.tool||'DinAllah-Rechercher')
  };
  entity[outputId]={
    'prov:type':'din:DigitalObject',
    'prov:label':String(info.outputPath||sha),
    'din:sha256':sha,
    'din:cell_id':String(info.cellId),
    'din:source_id':String(info.sourceId),
    'din:source_url':String(info.sourceUrl),
    ...(info.discoveredFrom?{'din:discovered_from':String(info.discoveredFrom)}:{}),
    'din:rights_status':String(info.rightsStatus||'review_required'),
    'din:format':String(info.outputFormat||'pdf'),
    ...(info.outputPath?{'din:path':String(info.outputPath)}:{})
  };
  entity[sourceId]={
    'prov:type':'din:SourceDocument',
    'prov:label':String(info.sourceUrl),
    'din:source_id':String(info.sourceId),
    'din:source_url':String(info.sourceUrl),
    'din:format':'web-source'
  };
  ensureMap(doc,'used')[`${activityId}:used:${clean(sourceId)}`]={
    'prov:activity':activityId,
    'prov:entity':sourceId
  };
  ensureMap(doc,'wasGeneratedBy')[`${outputId}:generated:${activityId}`]={
    'prov:entity':outputId,
    'prov:activity':activityId
  };
  ensureMap(doc,'wasAssociatedWith')[`${activityId}:associated:rechercher`]={
    'prov:activity':activityId,
    'prov:agent':'din:agent:rechercher'
  };
  ensureMap(doc,'hadPrimarySource')[`${outputId}:primary:${sourceId}`]={
    'prov:generatedEntity':outputId,
    'prov:usedEntity':sourceId
  };
  ensureMap(doc,'wasAttributedTo')[`${outputId}:attributed:${sourceAgentId}`]={
    'prov:entity':outputId,
    'prov:agent':sourceAgentId
  };
  if(info.derivedFrom){
    const used=String(info.derivedFrom.id||'');
    if(used){
      ensureMap(doc,'wasDerivedFrom')[`${outputId}:derived:${used}`]={
        'prov:generatedEntity':outputId,
        'prov:usedEntity':used,
        'prov:activity':activityId
      };
    }
  }
  return {activityId,outputId,sourceId};
}

export function recordDerivation(doc,{fromEntityId,toEntityId,activityId,activityType='din:Conversion',at=Date.now()}){
  const activity=String(activityId||`din:activity:derivation:${clean(toEntityId)}`);
  const stamp=new Date(at).toISOString();
  ensureMap(doc,'activity')[activity]={
    'prov:type':activityType,
    'prov:startTime':stamp,
    'prov:endTime':stamp,
    'din:tool':'DinAllah-Rechercher'
  };
  ensureMap(doc,'wasDerivedFrom')[`${toEntityId}:derived:${fromEntityId}`]={
    'prov:generatedEntity':String(toEntityId),
    'prov:usedEntity':String(fromEntityId),
    'prov:activity':activity
  };
  ensureMap(doc,'wasAssociatedWith')[`${activity}:associated:rechercher`]={
    'prov:activity':activity,
    'prov:agent':'din:agent:rechercher'
  };
  return activity;
}

export async function writeProvDocument(doc,{bundlePath,eventsPath}){
  const text=JSON.stringify(doc,null,2)+'\n';
  await fs.writeFile(bundlePath,text,'utf8');
  const events=[];
  for(const [id,a] of Object.entries(doc.activity||{})){
    events.push(JSON.stringify({id,type:a['prov:type'],startTime:a['prov:startTime'],endTime:a['prov:endTime'],cell_id:a['din:cell_id']||null,source_id:a['din:source_id']||null,run_id:a['din:run_id']||doc['din:run_id']||null}));
  }
  await fs.writeFile(eventsPath,events.join('\n')+(events.length?'\n':''),'utf8');
  return {activities:Object.keys(doc.activity||{}).length,entities:Object.keys(doc.entity||{}).length};
}

export function validateProvShape(doc){
  if(!doc||typeof doc!=='object') throw new Error('PROV document must be an object');
  if(doc.prefix?.prov!==PROV_NS||doc.prefix?.din!==DIN_NS) throw new Error('PROV namespaces missing');
  for(const [id,a] of Object.entries(doc.activity||{})){
    if(!a['prov:type']) throw new Error(`activity missing prov:type: ${id}`);
  }
  for(const [id,r] of Object.entries(doc.wasGeneratedBy||{})){
    if(!r['prov:entity']||!r['prov:activity']) throw new Error(`invalid wasGeneratedBy: ${id}`);
  }
  return true;
}
