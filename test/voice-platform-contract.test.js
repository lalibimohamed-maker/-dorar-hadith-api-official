const assert = require("assert");
const {
  STATES, canTransition, transitionRuntime, redactDiagnostics, normalizeProgress
} = require("../src/voice-platform-contract");

assert.deepStrictEqual(STATES.length, 9);
assert.strictEqual(canTransition("declared", "acquiring"), true);
assert.strictEqual(canTransition("declared", "ready"), false);

assert.throws(
  () => transitionRuntime("acquired", "checksum-verified", {sha256Verified:false}),
  /checksum evidence required/
);
assert.strictEqual(
  transitionRuntime("acquired", "checksum-verified", {sha256Verified:true}),
  "checksum-verified"
);
assert.throws(
  () => transitionRuntime("loaded", "inference-verified", {realInference:false}),
  /real inference evidence required/
);
assert.strictEqual(
  transitionRuntime("inference-verified", "ready", {
    sha256Verified:true, licenseReviewed:true, realInference:true
  }),
  "ready"
);

const safe = redactDiagnostics({
  token:"secret-value",
  api_key:"secret-key",
  nested:{authorization:"Bearer secret", ok:true}
});
assert.strictEqual(safe.token, "[REDACTED]");
assert.strictEqual(safe.api_key, "[REDACTED]");
assert.strictEqual(safe.nested.authorization, "[REDACTED]");
assert.strictEqual(safe.nested.ok, true);

assert.deepStrictEqual(
  normalizeProgress({sequence:4, phase:"asr-partial", completed:false}),
  {sequence:4, phase:"asr-partial", completed:false}
);

console.log("voice platform contract: OK");
