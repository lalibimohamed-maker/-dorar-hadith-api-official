import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('UI enhancement layer is optional and version-pinned', () => {
  const js = read('web/ui-enhancements.js');
  const sw = read('web/sw.js');
  const html = read('web/index.html');

  assert.match(js, /driver\.js@1\.4\.0/);
  assert.match(js, /lucide@0\.534\.0/);
  assert.doesNotMatch(js, /@latest/);
  assert.match(sw, /driver\.js@1\.4\.0/);
  assert.match(sw, /lucide@0\.534\.0/);
  assert.match(html, /ui-enhancements\.js/);
  assert.match(html, /ui-enhancements\.css/);
});

test('UI enhancement layer has an offline-safe fallback and does not write corpus data', () => {
  const js = read('web/ui-enhancements.js');
  const config = read('config/engineering-discovery-watchlist-2026.json');

  assert.match(js, /openNativeFallback/);
  assert.match(js, /deenAllahTourCompleted/);
  assert.match(config, /"corpusWritesAllowed": false/);
  assert.match(config, /"discoveryDoesNotImplyTrust": true/);
});

test('third-party UI notices are present', () => {
  assert.match(read('docs/third-party/DRIVERJS-LICENSE.txt'), /Copyright \(c\) Kamran Ahmed/);
  assert.match(read('docs/third-party/LUCIDE-LICENSE.txt'), /ISC License/);
});
