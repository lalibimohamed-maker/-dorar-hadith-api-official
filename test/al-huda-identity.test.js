import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Al-Huda identity is canonical', () => {
  const cfg=JSON.parse(fs.readFileSync('config/voice-system-radar-2026.json','utf8'));
  assert.equal(cfg.assistantIdentity.assistantName,'Al-Huda');
  assert.equal(cfg.assistantIdentity.arabicName,'الهُدَى');
  assert.equal(cfg.assistantIdentity.wakeWord,'الهُدَى');
  assert.equal(cfg.wakePhrase.defaultDisplayName,'الهُدَى');
  assert.equal(Object.hasOwn(cfg.wakePhrase,'previousName'),false);
});
