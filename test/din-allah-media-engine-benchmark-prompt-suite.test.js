import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const suite = JSON.parse(fs.readFileSync('config/din-allah-media-engine-benchmark-prompt-suite-2026.json', 'utf8'));

test('benchmark prompt suite is fixed and reusable across candidates', () => {
  assert.equal(suite.rules.fixedPromptText, true);
  assert.equal(suite.rules.samePromptAcrossCandidates, true);
  assert.equal(suite.rules.noQuranTextGeneration, true);
  assert.equal(suite.rules.noRecitationGeneration, true);
  assert.ok(suite.prompts.length >= 6);

  const ids = new Set();
  for (const prompt of suite.prompts) {
    assert.ok(prompt.id);
    assert.equal(ids.has(prompt.id), false);
    ids.add(prompt.id);
    assert.ok(prompt.prompt.length >= 80);
    assert.ok(Array.isArray(prompt.checks) && prompt.checks.length >= 2);
  }
});
