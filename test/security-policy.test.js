import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const policy = JSON.parse(fs.readFileSync("config/security-policy-2026.json", "utf8"));
const securityText = fs.readFileSync("SECURITY.md", "utf8");
const sourceRefresh = fs.readFileSync("scripts/source-refresh-gate.mjs", "utf8");

test("security policy contract protects the declared security boundary", () => {
  assert.deepEqual(policy.securityBoundary, [
    "source-code",
    "ci-cd",
    "source-registry",
    "corpus",
    "provenance",
    "rights-metadata",
    "generated-artifacts",
    "apis",
    "releases",
    "recovery-data"
  ]);
  assert.equal(policy.principles.defenseInDepth, true);
  assert.equal(policy.principles.leastPrivilege, true);
  assert.equal(policy.principles.failClosed, true);
  assert.equal(policy.principles.externalSourcesUntrustedUntilVerified, true);
  assert.equal(policy.principles.noSecretsInSourceClientOrArtifacts, true);
  assert.equal(policy.principles.sourceRefreshCannotDirectlyOverwriteCorpus, true);
  assert.equal(policy.principles.recoverableBackups, true);
  assert.equal(policy.principles.restorationVerificationRequired, true);
});

test("secure source refresh declares every required gate and executable mapping", () => {
  for (const gate of policy.secureSourceRefresh.requiredGates) {
    assert.ok(policy.gateImplementations[gate]?.length > 0, "missing implementation mapping: " + gate);
    for (const file of policy.gateImplementations[gate]) {
      assert.equal(fs.existsSync(file), true, "missing gate implementation: " + file);
    }
  }
  assert.equal(policy.secureSourceRefresh.failurePolicy, "retain-previous-verified-version");
  assert.equal(policy.secureSourceRefresh.uncertaintyPolicy, "retain-previous-verified-version");
});

test("incident response forbids retaliation and requires evidence preservation", () => {
  assert.deepEqual(policy.incidentResponse.steps, [
    "contain",
    "revoke",
    "isolate",
    "preserve-evidence",
    "patch",
    "verify",
    "restore",
    "document"
  ]);
  assert.equal(policy.incidentResponse.retaliationForbidden, true);
});

test("SECURITY.md remains the human-readable policy surface", () => {
  for (const heading of [
    "## Security boundary",
    "## Principles",
    "## Secure source refresh",
    "## Incident response"
  ]) assert.ok(securityText.includes(heading), "missing heading: " + heading);
});

test("source refresh contains SSRF-safe destination checks", () => {
  assert.match(sourceRefresh, /node:dns\/promises/);
  assert.match(sourceRefresh, /node:net/);
  assert.match(sourceRefresh, /private or reserved DNS destination rejected/);
  assert.match(sourceRefresh, /private or reserved source address rejected/);
  assert.match(sourceRefresh, /redirect rejected/);
  assert.match(sourceRefresh, /MAX_RESPONSE_BYTES/);
  assert.match(sourceRefresh, /REQUEST_TIMEOUT_MS/);
  assert.match(sourceRefresh, /MAX_REDIRECTS/);
});
