import fs from "node:fs";
import path from "node:path";

const securityPolicyPath = "config/security-policy-2026.json";
const workflowRoot = ".github/workflows";
const workflowFiles = fs.readdirSync(workflowRoot).filter((name) => /\.ya?ml$/i.test(name));
const findings = [];

for (const name of workflowFiles) {
  const file = path.join(workflowRoot, name);
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    const uses = line.match(/^\s*uses:\s*([^\s#]+)/);
    if (uses) {
      const ref = uses[1];
      if (!ref.startsWith("./") && !ref.startsWith("docker://") && !/@[0-9a-f]{40}$/i.test(ref)) {
        findings.push(`${file}:${index + 1}: external action is not pinned to a full SHA: ${ref}`);
      }
    }

    // Match executable shell commands, not regex literals embedded in a scanner.
    const commandPrefix = "(?:^|(?:run:\s*|[;&|]\s*))";
    if (new RegExp(`${commandPrefix}(?:curl|wget)\\b[^|;\\n]*\\|\\s*(?:bash|sh)\\b`, "i").test(line)) {
      findings.push(`${file}:${index + 1}: remote shell execution pattern detected`);
    }
    if (new RegExp(`${commandPrefix}chmod\\s+777\\b`, "i").test(line)) {
      findings.push(`${file}:${index + 1}: world-writable chmod detected`);
    }
  }

  if (!/^permissions:/m.test(text)) {
    findings.push(`${file}: workflow must declare explicit top-level permissions`);
  }
}

const securityPolicy = JSON.parse(fs.readFileSync(securityPolicyPath, "utf8"));
if (securityPolicy.principles?.defenseInDepth !== true ||
    securityPolicy.principles?.leastPrivilege !== true ||
    securityPolicy.principles?.failClosed !== true ||
    securityPolicy.principles?.externalSourcesUntrustedUntilVerified !== true ||
    securityPolicy.principles?.noSecretsInSourceClientOrArtifacts !== true ||
    securityPolicy.principles?.sourceRefreshCannotDirectlyOverwriteCorpus !== true) {
  findings.push("security-policy-2026.json is missing mandatory fail-closed security principles");
}
if (!Array.isArray(securityPolicy.secureSourceRefresh?.requiredGates) ||
    securityPolicy.secureSourceRefresh.requiredGates.length === 0) {
  findings.push("security policy must declare secure source refresh gates");
}
for (const gate of securityPolicy.secureSourceRefresh?.requiredGates || []) {
  const implementations = securityPolicy.gateImplementations?.[gate];
  if (!Array.isArray(implementations) || implementations.length === 0) {
    findings.push("security policy has no implementation mapping for source refresh gate: " + gate);
    continue;
  }
  for (const file of implementations) {
    if (!fs.existsSync(file)) findings.push("security policy references missing implementation: " + file);
  }
}
if (securityPolicy.secureSourceRefresh?.failurePolicy !== "retain-previous-verified-version" ||
    securityPolicy.secureSourceRefresh?.uncertaintyPolicy !== "retain-previous-verified-version") {
  findings.push("source refresh uncertainty must retain the previous verified version");
}
if (securityPolicy.incidentResponse?.retaliationForbidden !== true) {
  findings.push("incident response must forbid retaliation");
}

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const dependencyCount = Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies }).length;
if (dependencyCount > 0 && !fs.existsSync("package-lock.json")) {
  findings.push("package-lock.json is required when npm dependencies are declared");
}

if (findings.length) {
  console.error("Security baseline violations:");
  console.error(findings.join("\n"));
  process.exit(1);
}

console.log(`Security baseline passed: ${workflowFiles.length} workflows checked; dependency lock policy satisfied.`);
