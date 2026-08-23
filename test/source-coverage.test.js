import assert from "node:assert/strict";
import test from "node:test";
import { assertSourceCoverage, getSourceCoverageReport } from "../src/source-coverage.js";

test("existing source registry covers the encyclopedia core categories", () => {
  const report = assertSourceCoverage();
  assert.equal(report.healthy, true);
  assert.equal(report.missingCategories.length, 0);
  assert.ok(report.sourceCount > 0);
  assert.ok(report.bookCount > 0);
});

test("source coverage report is inspectable", () => {
  const report = getSourceCoverageReport();
  assert.ok(report.categoryCount >= 10);
  assert.ok(Array.isArray(report.policyChecks));
});
