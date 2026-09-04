#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

const MANIFEST=process.env.MANIFEST ?? '';
const OUTPUT=process.env.OUTPUT ?? 'data/corpus/rechercher/purge-plan-2026.json';

async function main(){
 if(!MANIFEST) throw new Error('MANIFEST is required; this tool never guesses a source of material to purge.');
 const payload=JSON.parse(await readFile(MANIFEST,'utf8'));
 const rows=payload.results||payload.books||[];
 const purge=rows.filter(r=>['underlying-work-protected','unclear','conflict','read-only','link-only','unreachable'].includes(r.rightsDecision)||r.eligibleForMirror===false);
 const plan={version:'2026.09.02',engine:'@Rechercher',sourceManifest:MANIFEST,action:'quarantine-from-mirroring',count:purge.length,items:purge.map(r=>({id:r.id,index:r.index,title:r.title||r.titleHint,sourceUrl:r.sourceUrl,rightsDecision:r.rightsDecision,reason:r.classificationReason||r.reason||r.error})) ,note:'The tool produces a removal/quarantine plan only. It does not delete source records; provenance is retained so a later rights correction can be audited.'};
 await writeFile(OUTPUT,JSON.stringify(plan,null,2)+'\n'); console.log(JSON.stringify({output:OUTPUT,count:plan.count},null,2));
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
