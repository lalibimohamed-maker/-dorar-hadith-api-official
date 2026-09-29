import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const registry = JSON.parse(
  fs.readFileSync(new URL("../config/continuous-evolution-policy-2026.json", import.meta.url), "utf8")
);

test("continuous evolution policy preserves the non-closure and free-first boundaries", () => {
  assert.equal(registry.principles.continuousEvolution, true);
  assert.equal(registry.principles.noArtificialClosure, true);
  assert.equal(registry.principles.freeFirst, true);
  assert.equal(registry.principles.automationDoesNotEqualBlindPublication, true);
  assert.equal(registry.principles.canonicalCorpusProtected, true);
  assert.equal(registry.principles.mainProtectionMustRemain, true);
});

test("autonomy levels separate fully automatic operations from review-gated scholarly changes", () => {
  const automatic = registry.autonomyLevels.fullyAutomatic;
  const review = registry.autonomyLevels.automaticWithPullRequestAndReview;
  const blocked = registry.autonomyLevels.neverAutomaticWithoutScientificOrRightsVerification;

  assert.ok(automatic.includes("scheduled-source-health-check"));
  assert.ok(automatic.includes("coverage-gap-detection"));
  assert.ok(automatic.includes("dependabot-dependency-updates"));
  assert.ok(review.includes("new-source-registry-entry"));
  assert.ok(review.includes("candidate-to-stronger-status-promotion"));
  assert.ok(blocked.includes("promote-new-religious-text-as-authoritative"));
  assert.ok(blocked.includes("promote-raw-ocr-to-reference-text"));
  assert.ok(blocked.includes("bypass-protected-main"));
});

test("update cycle contains discovery, rights, quarantine, review, verification and historical recording", () => {
  assert.deepEqual(registry.updateCycle, [
    "discovery",
    "source-verification",
    "rights-check",
    "change-comparison",
    "quarantine-when-needed",
    "review",
    "ci-and-security",
    "promotion-through-protected-main",
    "historical-record"
  ]);
});

test("content gaps remain tracked and never become a closure condition", () => {
  assert.equal(registry.nonClosure.contentGapsAreTracked, true);
  assert.equal(registry.nonClosure.contentGapsDoNotCloseSystem, true);
  assert.equal(registry.nonClosure.gapsRemainRecheckable, true);
  assert.equal(registry.nonClosure.gapResolutionRequiresVerifiedMaterialOrTrustedOfficialLink, true);
});

test("promotion remains human and rights gated", () => {
  for (const key of [
    "automaticPromotionToMain",
    "pullRequestRequiredForScholarlyChanges",
    "rightsRequired",
    "provenanceRequired",
    "sourceIdentityRequired",
    "evidenceRequired",
    "independentReviewRequired",
    "protectedMainRequired",
    "rawOcrCannotBecomeAuthoritative",
    "copyrightedMaterialCannotBeCopiedWithoutPermission"
  ]) {
    const expected = key === "automaticPromotionToMain" ? false : true;
    assert.equal(registry.promotionRules[key], expected, key);
  }
});

test("control mappings point to existing governance components", () => {
  const required = Object.values(registry.controlMappings).flat();
  for (const relative of required) {
    assert.ok(fs.existsSync(new URL(`../${relative}`, import.meta.url)), relative);
  }
});
