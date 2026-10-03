import test from 'node:test';
import assert from 'node:assert/strict';
import { createResearchFoundationEngine, registerProvenance, setRights, publishableSource } from '../src/rechercher-v5-research-foundation-engine.js';

test('v5 foundation requires verified provenance and allowed rights', () => {
  const engine = createResearchFoundationEngine();
  registerProvenance(engine, { sourceId: 's1', contentHash: 'h1', provenanceVerified: true });
  assert.equal(publishableSource(engine, 's1'), false);
  setRights(engine, 's1', 'ALLOWED');
  assert.equal(publishableSource(engine, 's1'), true);
});
