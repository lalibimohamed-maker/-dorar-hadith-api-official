import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeAdvancedFaraid,
  analyzePregnancy,
  analyzeMissingPerson,
  analyzeAmbiguousSex,
  analyzeMunasakhat
} from "../src/faraid-advanced.js";

test("pregnancy is scenario-only and never silently finalizes", () => {
  const result = analyzePregnancy({ estate: 100000, madhhab: "hanbali", knownHeirs: { mother: 1 } });
  assert.equal(result.status, "scenario_only");
  assert.equal(result.scenarios.length, 3);
  assert.match(result.warning, /لا يجوز/);
});

test("missing person requires judicial determination unless death is established", () => {
  const pending = analyzeMissingPerson({ estate: 100000, legalStatus: "unknown" });
  assert.equal(pending.status, "hold_for_judicial_determination");
  const confirmed = analyzeMissingPerson({ estate: 100000, legalStatus: "deceased" });
  assert.equal(confirmed.status, "ready_for_distribution");
});

test("ambiguous sex exposes both recognized scenarios", () => {
  const result = analyzeAmbiguousSex({ estate: 50000, madhhab: "shafii" });
  assert.equal(result.status, "scenario_only");
  assert.deepEqual(result.scenarios.map(x => x.name), ["male", "female"]);
});

test("munasakhat requires the second death data before finalization", () => {
  const result = analyzeMunasakhat({ firstEstate: 100000, firstHeirs: { sons: 1, daughters: 1 } });
  assert.equal(result.status, "input_required");
  assert.ok(result.required.includes("second heirs"));
});

test("advanced dispatcher routes supported cases", () => {
  assert.equal(analyzeAdvancedFaraid({ case: "pregnancy" }).case, "pregnancy");
  assert.equal(analyzeAdvancedFaraid({ case: "missing_person" }).case, "missing_person");
  assert.equal(analyzeAdvancedFaraid({ case: "ambiguous_sex" }).case, "ambiguous_sex");
  assert.equal(analyzeAdvancedFaraid({ case: "munasakhat" }).case, "munasakhat");
});
