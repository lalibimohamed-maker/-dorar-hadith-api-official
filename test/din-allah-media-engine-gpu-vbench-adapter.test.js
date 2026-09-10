import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const promptPath = 'tools/din-allah-media-engine/gpu-evaluation/vbench-custom-prompt.json';

test('VBench custom prompt adapter is a filename-to-prompt object', () => {
  const prompts = JSON.parse(fs.readFileSync(promptPath, 'utf8'));
  assert.equal(typeof prompts, 'object');
  const entries = Object.entries(prompts);
  assert.equal(entries.length, 6);
  for (const [filename, prompt] of entries) {
    assert.match(filename, /^ant-[a-z-]+-\d{2}\.mp4$/);
    assert.equal(typeof prompt, 'string');
    assert.ok(prompt.length > 40);
  }
});

test('VBench adapter has no religious text in generation prompts', () => {
  const prompts = JSON.parse(fs.readFileSync(promptPath, 'utf8'));
  for (const prompt of Object.values(prompts)) {
    assert.doesNotMatch(prompt, /القرآن|Quran|Qur'an|آية|ayah/i);
  }
});
