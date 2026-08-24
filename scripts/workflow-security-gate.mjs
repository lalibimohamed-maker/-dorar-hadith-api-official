import fs from "node:fs";
import path from "node:path";

const root = ".github/workflows";
const files = fs.existsSync(root)
  ? fs.readdirSync(root).filter(f => /\.(yml|yaml)$/i.test(f)).sort()
  : [];

const findings = [];
const sha40 = /^[0-9a-f]{40}$/i;

for (const file of files) {
  const p = path.join(root, file);
  const text = fs.readFileSync(p, "utf8");

  if (/pull_request_target\s*:/.test(text)) findings.push(`${file}: pull_request_target is prohibited`);
  if (/issue_target\s*:/.test(text)) findings.push(`${file}: issue_target is prohibited`);

  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*uses:\s*([^\s#]+)\s*(?:#.*)?$/);
    if (m) {
      const ref = m[1].split("@")[1];
      if (!ref || !sha40.test(ref)) findings.push(`${file}: Action is not pinned to a full 40-character SHA: ${m[1]}`);
    }
  }

  if (/^\s*permissions:\s*read-all\s*$/m.test(text)) {
    findings.push(`${file}: workflow-level permissions: read-all is prohibited; declare the minimum required permissions`);
  }
  if (/^\s*contents:\s*write\s*$/m.test(text) && !/reason:.*contents: write/i.test(text)) {
    findings.push(`${file}: contents: write requires an explicit security justification`);
  }
  if (/^\s*actions:\s*write\s*$/m.test(text)) findings.push(`${file}: actions: write is prohibited`);

  if (/\b(curl|wget)\b[^\n|]*\|\s*(bash|sh)\b/.test(text)) {
    findings.push(`${file}: remote content piped directly to a shell is prohibited`);
  }
  if (/chmod\s+777/.test(text)) findings.push(`${file}: chmod 777 is prohibited`);

  if (/actions\/checkout@/i.test(text) && !/persist-credentials:\s*false/.test(text)) {
    findings.push(`${file}: checkout must set persist-credentials: false`);
  }
}

if (findings.length) {
  console.error("Workflow Security Gate FAILED:");
  console.error(findings.join("\n"));
  process.exit(1);
}
console.log(`Workflow Security Gate PASSED: inspected ${files.length} workflow files.`);
