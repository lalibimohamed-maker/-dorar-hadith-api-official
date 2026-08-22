import assert from 'node:assert/strict';
import { resolveGhaybDomain, buildGhaybResearchPlan } from '../src/ghayb-router.js';

const paradise = resolveGhaybDomain('طبقات الجنة ونعيمها');
assert.equal(paradise?.ghaybDomain, 'paradise');
assert.equal(paradise?.creedSensitive, true);
assert.equal(paradise?.evidencePolicy?.neverPromoteWeakToFact, true);

const fire = resolveGhaybDomain('عذاب القبر');
assert.equal(fire?.ghaybDomain, 'grave');

const plan = buildGhaybResearchPlan('مفاتيح الغيب', { language: 'fr' });
assert.equal(plan?.language, 'fr');
assert.equal(plan?.concept?.ghaybDomain, 'keys-of-unseen');
assert.equal(plan?.rules?.citeEveryClaim, true);
assert.equal(plan?.rules?.doNotPresentUnknownAsFact, true);

console.log('ghayb routing tests: OK');
