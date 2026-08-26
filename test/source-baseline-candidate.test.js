import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const script = fs.readFileSync(new URL("../scripts/source-baseline-candidate.mjs", import.meta.url), "utf8");
const workflow = fs.readFileSync(new URL("../.github/workflows/source-baseline-candidate.yml", import.meta.url), "utf8");

// These are policy-level invariants for a metadata-only candidate generator.
// Execution is intentionally handled by the dedicated workflow under CI.
test("baseline candidate generator is non-authoritative", () => {
  assert.match(script, /authoritative: false/);
  assert.match(script, /manifest\.json/);
  assert.match(script, /sha256/);
});

test("baseline candidate generator never writes the trusted baseline", () => {
  assert.doesNotMatch(script, /source-refresh-baselines\.json/);
  assert.doesNotMatch(workflow, /source-refresh-baselines\.json/);
});

test("candidate workflow is read-only and fail-closed on verifier failure", () => {
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.match(workflow, /gate_exit/);
  assert.match(workflow, /No baseline candidate was generated/);
});

test("candidate workflow never turns a failed protected refresh into trusted output", () => {
  assert.match(workflow, /if: \$\{\{ steps\.verify\.outputs\.gate_exit == '0' \}\}/);
  assert.match(workflow, /Protected verification gate did not fully pass/);
});
