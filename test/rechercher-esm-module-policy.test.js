import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile() && full.endsWith('.js')) files.push(full);
  }
  return files;
}

test('repository JavaScript modules do not mix CommonJS exports into ESM .js files', () => {
  const violations = [];
  for (const file of [...walk(path.join(root, 'src')), ...walk(path.join(root, 'test'))]) {
    const text = fs.readFileSync(file, 'utf8');
    if (/^\s*module\.exports\s*=|^\s*exports\.[A-Za-z_$]/m.test(text)) {
      violations.push(path.relative(root, file));
    }
  }
  assert.deepEqual(violations, [], `CommonJS exports remain in ESM .js files: ${violations.join(', ')}`);
});
