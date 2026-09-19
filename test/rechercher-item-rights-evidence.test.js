import test from 'node:test';
import assert from 'node:assert/strict';
import {extractRightsMetadata, decideItemRedistribution, RIGHTS_FIELDS} from '../scripts/rechercher_extract_item_rights.mjs';

test('rights extractor captures the complete required metadata contract', () => {
  assert.deepEqual(RIGHTS_FIELDS, ['license','license_url','rights','copyright','public_domain','cc0','cc_by','cc_by_sa','permission_statements','institutional_terms','item_level_metadata']);
  const evidence = extractRightsMetadata({itemId: 'IA:book-123', resourceId: 'res-123', sourceUrl: 'https://example.org/item/123', metadata: {identifier: 'IA:book-123', license: 'CC BY-SA 4.0', license_url: 'https://creativecommons.org/licenses/by-sa/4.0/', rights: 'May be redistributed with attribution and share-alike.', copyright: 'Public domain notice', public_domain: true, cc0: false, cc_by: true, cc_by_sa: true, permission_statements: 'Permission to redistribute with attribution.', institutional_terms: 'Institutional terms apply.'}});
  assert.equal(evidence.item_identity, 'IA:book-123');
  assert.equal(evidence.item_level_match, true);
  assert.equal(evidence.normalized.license, 'CC BY-SA 4.0');
  assert.equal(evidence.normalized.license_url, 'https://creativecommons.org/licenses/by-sa/4.0/');
  assert.equal(evidence.normalized.public_domain, true);
  assert.equal(evidence.normalized.cc_by_sa, true);
  assert.ok(evidence.normalized.permission_statements.length > 0);
  assert.ok(evidence.evidence_fingerprint);
  assert.equal(decideItemRedistribution(evidence).redistribution_permission, 'verified-per-item');
});

test('generic source rights do not become item-level redistribution permission', () => {
  const evidence = extractRightsMetadata({itemId: 'IA:book-123', sourceUrl: 'https://archive.org/legal/terms.php', text: 'Terms of use. Some materials may be public domain. CC BY resources may exist.'});
  const decision = decideItemRedistribution(evidence);
  assert.equal(evidence.item_level_match, false);
  assert.equal(decision.item_level_rights_verified, false);
  assert.equal(decision.redistribution_permission, 'not-granted');
  assert.equal(decision.rights_decision, 'fail-closed');
});

test('missing identity or ambiguous rights remain discoverable but fail closed', () => {
  const evidence = extractRightsMetadata({sourceUrl: 'https://example.org/item/123', text: 'CC BY 4.0 license may apply.'});
  const decision = decideItemRedistribution(evidence);
  assert.equal(decision.redistribution_permission, 'not-granted');
  assert.equal(decision.rights_status, 'review-required');
});

test('known rights preserve license conditions for browser delivery', () => {
  const evidence = extractRightsMetadata({itemId: 'item-1', resourceId: 'resource-1', metadata: {identifier: 'item-1', license: 'CC BY 4.0', license_url: 'https://creativecommons.org/licenses/by/4.0/'}});
  const decision = decideItemRedistribution(evidence);
  assert.equal(decision.redistribution_permission, 'verified-per-item');
  assert.equal(decision.item_level_rights_verified, true);
  assert.equal(evidence.normalized.license, 'CC BY 4.0');
});
