import fs from "node:fs";
import path from "node:path";

const root = ".github/workflows";
const files = fs.existsSync(root) ? fs.readdirSync(root).filter(f => /.(yml|yaml)$/i.test(f)).sort() : [];
const findings = [];
const sha40 = /^[0-9a-f]{40}$/i;
const add = (f,m) => findings.push(`${f}: ${m}`);

for (const file of files) {
  const text = fs.readFileSync(path.join(root,file),"utf8");
  if (/pull_request_targets*:/.test(text)) add(file,"pull_request_target is prohibited");
  if (/issue_targets*:/.test(text)) add(file,"issue_target is prohibited");
  if (/workflow_runs*:/.test(text)) add(file,"workflow_run requires a reviewed exception and is prohibited by default");
  for (const line of text.split(/?
/)) {
    const m=line.match(/^s*uses:s*([^s#]+)s*(?:#.*)?$/);
    if(m){const ref=m[1].split("@")[1]; if(!ref||!sha40.test(ref)) add(file,`Action is not pinned to a full 40-character SHA: ${m[1]}`);}
  }
  if(/^s*permissions:s*read-alls*$/m.test(text)) add(file,"workflow-level permissions: read-all is prohibited");
  if(/^s*actions:s*writes*$/m.test(text)) add(file,"actions: write is prohibited");
  if(/^s*contents:s*writes*$/m.test(text)&&!/security-justification:/i.test(text)) add(file,"contents: write requires a security-justification marker");
  if(/^s*id-token:s*writes*$/m.test(text)&&!/oidc|scorecard|provenance|attestation/i.test(text)) add(file,"id-token: write requires an OIDC/provenance purpose");
  if(/(curl|wget)[^
|]*|s*(bash|sh)/.test(text)) add(file,"remote content piped directly to a shell is prohibited");
  if(/chmods+777/.test(text)) add(file,"chmod 777 is prohibited");
  if(/gits+configs+--global/i.test(text)) add(file,"global git configuration in CI is prohibited");
  if(/actions/checkout@/i.test(text)&&!/persist-credentials:s*false/.test(text)) add(file,"checkout must set persist-credentials: false");
  if(/(AWS_SECRET_ACCESS_KEY|OPENAI_API_KEY|GH_TOKEN|GITHUB_TOKEN|NPM_TOKEN|PASSWORD|PRIVATE_KEY)s*:s*['"][^$
]+['"]/i.test(text)) add(file,"possible hard-coded secret detected");
  if(/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) add(file,"private key material detected");
  const runs=text.split(/^s*run:s*|?s*$/m).slice(1);
  for(const block of runs) if(/${{s*(github.event.(pull_request|issue|comment)|github.head_ref|github.event.pull_request.(title|body))/.test(block)) add(file,"untrusted GitHub event data interpolated into a shell run block");
  if(/(curl|wget)/.test(text)&&/s(?:--requests+|-[Xx]s+)(POST|PUT|PATCH)/i.test(text)&&!/network-write-justification:/i.test(text)) add(file,"network write requires a network-write-justification marker");
  if(!/^s*permissions:s*$/m.test(text)) add(file,"workflow must declare top-level permissions");
  if(/(?:rm|cp|mv|tar)s+[^
]*${{s*github.event./.test(text)) add(file,"event-derived path used directly in filesystem command");
}
if(findings.length){console.error("Workflow Security Gate FAILED:");console.error(findings.join("
"));process.exit(1);}
console.log(`Workflow Security Gate PASSED: inspected ${files.length} workflow files with trigger, permission, action, secret, shell, checkout, network and untrusted-input policies.`);