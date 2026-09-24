import fs from 'node:fs/promises';

const ROOT = process.cwd();
const matrix = JSON.parse(await fs.readFile('config/rechercher/global-multilingual-search-matrix-2026.json','utf8'));
const adapters = JSON.parse(await fs.readFile('config/rechercher/islamic-source-adapters-2026.json','utf8')).adapters ?? [];
const discovery = JSON.parse(await fs.readFile('config/rechercher/global-multilingual-resource-discovery-2026.json','utf8'));
const expansion = JSON.parse(await fs.readFile('config/rechercher/multilingual-resource-expansion-2026.json','utf8'));

const concurrency = Number(process.env.RIGHTS_AUDIT_CONCURRENCY || 8);
const timeoutMs = Number(process.env.RIGHTS_AUDIT_TIMEOUT_MS || 15000);
const termsPatterns = [
  /(?:license|licence|copyright|rights|permission|terms|policy|public domain|creative commons|redistribut|reuse|download|share|copy)/i
];
const urlPattern = /https?:\/\/[^\s"'<>]+/g;

function sourceRecords() {
  const map = new Map();
  const add = (x) => {
    if (!x) return;
    const id = String(x.id || x.name || x.url || x.base_url || '').trim();
    const url = String(x.base_url || x.url || '').trim();
    if (!id || !url || !/^https?:\/\//i.test(url)) return;
    if (!map.has(id)) map.set(id, {id,name:x.name||id,url,kind:x.kind||null,release_policy:x.release_policy||null,rights_policy:x.rights_policy||null});
  };
  for (const x of adapters) add(x);
  for (const x of discovery.evidence_sources || []) add(x);
  for (const x of expansion.providers || []) add(x);
  return [...map.values()];
}
const sources = sourceRecords();

const languages = Array.isArray(discovery.enumerated_islamhouse_languages)
  ? discovery.enumerated_islamhouse_languages.map((name,i)=>({name,iso:null,index:i}))
  : [];
const domains = matrix.domains || [];
if (languages.length * domains.length !== 3192) {
  throw new Error(`Expected 3192 cells, got ${languages.length * domains.length}`);
}

async function fetchUrl(url) {
  const ctl = new AbortController();
  const timer = setTimeout(()=>ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url,{redirect:'follow',signal:ctl.signal,headers:{
      'user-agent':'DinAllah-Rechercher/rights-audit/1.0',
      accept:'text/html,application/json;q=0.9,*/*;q=0.1'
    }});
    const text = await res.text();
    const hits = [];
    for (const p of termsPatterns) {
      if (p.test(text)) hits.push(p.source);
    }
    const links = [...new Set((text.match(urlPattern)||[]).slice(0,200))];
    return {
      http_status:res.status, ok:res.ok, final_url:res.url,
      content_type:res.headers.get('content-type')||null,
      rights_signal:hits.length>0,
      discovered_urls:links,
      checked_at:new Date().toISOString()
    };
  } catch (e) {
    return {http_status:null,ok:false,final_url:url,content_type:null,rights_signal:false,discovered_urls:[],error:String(e?.message||e),checked_at:new Date().toISOString()};
  } finally { clearTimeout(timer); }
}

const sourceAudit=[];
for(let i=0;i<sources.length;i+=concurrency){
  const batch=sources.slice(i,i+concurrency);
  const results=await Promise.all(batch.map(async s=>({source:s,result:await fetchUrl(s.url)})));
  sourceAudit.push(...results);
}

const sourceById=new Map(sourceAudit.map(x=>[x.source.id,x]));
const cells=[];
for(const lang of languages){
  for(const domain of domains){
    const cellId=`islamhouse-133:${lang.name}:${domain}`;
    const candidates=sourceAudit.map(x=>{
      const s=x.source, a=x.result;
      const policy=s.rights_policy;
      const explicitPolicy=policy?.kind && policy?.evidence_url;
      return {
        provider:s.id,
        source_identity:s.name,
        source_url:s.url,
        rights_policy_kind:policy?.kind||null,
        rights_policy_url:policy?.evidence_url||null,
        rights_conditions:policy?.conditions||[],
        source_release_policy:s.release_policy||null,
        source_page_checked:a.checked_at,
        source_http_status:a.http_status,
        source_rights_signal:a.rights_signal,
        source_accessible:a.ok,
        source_final_url:a.final_url,
        source_level_status: explicitPolicy ? 'policy-evidence-present' : (a.rights_signal ? 'rights-signal-found-review-required' : 'rights-not-established'),
        item_level_required:true
      };
    });
    cells.push({
      run_id:process.env.GITHUB_RUN_ID||'local',
      cell_id:cellId,
      language:lang.name,
      language_iso:lang.iso,
      domain,
      source_count:candidates.length,
      rights_policy:{
        discovery_does_not_equal_redistribution_permission:true,
        source_level_rights_do_not_replace_item_level_rights:true,
        download_eligibility_must_be_decided_per_resource:true,
        public_redistribution_requires_explicit_evidence:true
      },
      sources:candidates,
      next_action:'resolve-resource-candidates-then-item-level-rights'
    });
  }
}

await fs.mkdir('research/evidence/global-multilingual/rights-audit',{recursive:true});
await fs.writeFile('research/evidence/global-multilingual/rights-audit/source-rights-audit.json',JSON.stringify({
  schema:'rechercher/source-rights-audit/v1',
  generated_at:new Date().toISOString(),
  source_count:sources.length,
  cell_count:cells.length,
  source_audit:sourceAudit
},null,2)+'\n');
await fs.writeFile('research/evidence/global-multilingual/rights-audit/cell-rights-audit.jsonl',cells.map(x=>JSON.stringify(x)).join('\n')+'\n');

const summary={
  schema:'rechercher/3192-cell-rights-audit-summary/v1',
  generated_at:new Date().toISOString(),
  expected_cells:3192,
  audited_cells:cells.length,
  source_count:sources.length,
  accessible_sources:sourceAudit.filter(x=>x.result.ok).length,
  sources_with_rights_signal:sourceAudit.filter(x=>x.result.rights_signal).length,
  sources_with_explicit_policy:sourceAudit.filter(x=>x.source.rights_policy?.kind && x.source.rights_policy?.evidence_url).length,
  policy:'rights audit precedes acquisition; unknown rights are preserved as review-required and never treated as redistribution permission',
  item_level_required:true
};
await fs.writeFile('research/evidence/global-multilingual/rights-audit/summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
