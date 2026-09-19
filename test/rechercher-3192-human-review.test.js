import test from 'node:test';
import assert from 'node:assert/strict';
import registry from '../config/rechercher-3192-human-review-cells-2026.json' with { type: 'json' };

test('Rechercher 3192-cell human-review registry is complete and fail-closed', () => {
  assert.equal(registry.counts.languages, 132);
  assert.equal(registry.counts.domains, 24);
  assert.equal(registry.counts.cells, 3192);
  assert.equal(registry.cells.length, 3192);
  assert.equal(registry.counts.humanReviewed, 0);
  assert.equal(registry.counts.pendingHumanReview, 3192);
  assert.equal(registry.policy.humanReviewRequiredForAuthoritativeUse, true);
  assert.equal(registry.policy.noSyntheticAttestation, true);
  assert.equal(registry.policy.automaticPromotion, false);
  assert.ok(registry.cells.every(cell => cell.status === 'HUMAN_REVIEW_REQUIRED'));
  assert.ok(registry.cells.every(cell => cell.review.attested === false));
  assert.ok(registry.cells.every(cell => cell.promotionBlocked === true));
  assert.equal(registry.cells.filter(cell => cell.cellType === 'LANGUAGE_DOMAIN').length, 3168);
  assert.equal(registry.cells.filter(cell => cell.cellType === 'CROSS_DOMAIN_GOVERNANCE').length, 24);
});
