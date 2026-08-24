import fs from "node:fs";
import path from "node:path";

const root = ".github/workflows";
const files = fs.existsSync(root) ? fs.readdirSync(root).filter(f => /\.(yml|yaml)$/i.test(f)).sort() : [];
const findings = [];
const sha40 = /^[0-9a-f]{40}$/i;
const add = (f, m) => findings.push(`${f}: ${m}`);

for (const file of files) {
  const text = fs.readFileSync(path.join(root, file), "utf8");

  if (/pull_request_target\s*:/.test(text)) add(file, "pull_request_target is prohibited");
  if (/issue_target\s*:/.test(text)) add(file, "issue_target is prohibited");
  if (/workflow_run\s*:/.test(text)) add(file, "workflow_run requires a reviewed exception and is prohibited by default");

  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*uses:\s*([^\s#]+)\s*(?:#.*)?$/);
    if (m) {
      const ref = m[1].split("@")[1];
      if (!ref || !sha40.test(ref)) add(file, `Action is not pinned to a full 40-character SHA: ${m[1]}`);
    }
  }

  if (/^\s*permissions:\s*read-all\s*$/m.test(text)) add(file, "workflow-level permissions: read-all is prohibited");
  if (/^\s*actions:\s*write\s*$/m.test(text)) add(file, "actions: write is prohibited");
  if (/^\s*contents:\s*write\s*$/m.test(text) && !/security-justification:/i.test(text)) add(file, "contents: write requires a security-justification marker");
  if (/^\s*id-token:\s*write\s*$/m.test(text) && !/oidc|scorecard|provenance|attestation/i.test(text)) add(file, "id-token: write requires an OIDC/provenance purpose");

  if (/\b(curl|wget)\b[^\n|]*\|\s*(bash|sh)\b/.test(text)) add(file, "remote content piped directly to a shell is prohibited");
  if (/chmod\s+777/.test(text)) add(file, "chmod 777 is prohibited");
  if (/git\s+config\s+--global/i.test(text)) add(file, "global git configuration in CI is prohibited");

  if (/actions\/checkout@/i.test(text) && !/persist-credentials:\s*false/.test(text)) add(file, "checkout must set persist-credentials: false");

  if (/\b(AWS_SECRET_ACCESS_KEY|OPENAI_API_KEY|GH_TOKEN|GITHUB_TOKEN|NPM_TOKEN|PASSWORD|PRIVATE_KEY)\s*:\s*['"][^$\n]+['"]/i.test(text)) add(file, "possible hard-coded secret detected");
  if (/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) add(file, "private key material detected");

  const runBlocks = text.split(/^\s*run:\s*\|?\s*$/m).slice(1);
  for (const block of runBlocks) {
    if (/\$\{\{\s*(github\.event\.(pull_request|issue|comment)|github\.head_ref|github\.event\.pull_request\.(title|body))/.test(block)) {
      add(file, "untrusted GitHub event data interpolated into a shell run block");
    }
  }

  if (/\b(curl|wget)\b/.test(text) && /\s(?:--request\s+|-[Xx]\s+)(POST|PUT|PATCH)/i.test(text) && !/network-write-justification:/i.test(text)) {
    add(file, "network write requires a network-write-justification marker");
  }

  if (!/^\s*permissions:\s*$/m.test(text)) add(file, "workflow must declare top-level permissions");

  if (/(?:rm|cp|mv|tar)\s+[^\n]*\$\{\{\s*github\.event\./.test(text)) {
    add(file, "event-derived path used directly in filesystem command");
  }
}

if (findings.length) {
  console.error("Workflow Security Gate FAILED:");
  console.error(findings.join("\n"));
  process.exit(1);
}
console.log(`Workflow Security Gate PASSED: inspected ${files.length} workflow files with trigger, permission, action, secret, shell, checkout, network and untrusted-input policies.`);