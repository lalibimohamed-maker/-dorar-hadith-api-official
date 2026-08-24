#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import net from 'node:net';

const REGISTRIES = [
  'config/source-registry.json',
  'config/official-islamic-sources-2026.json'
];
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 4;
const UA = 'DinAllah-source-refresh-gate/1.0';

const badHost = (host) => {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (!h || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') ||
      h === 'metadata.google.internal' || h === 'metadata.google') return true;
  if (net.isIP(h)) {
    const parts = h.split('.').map(Number);
    if (parts.length === 4 &&
      (parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
       (parts[0] === 169 && parts[1] === 254) ||
       (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
       (parts[0] === 192 && parts[1] === 168))) return true;
    if (h.includes(':')) return true; // IPv6 is rejected in the privileged refresh path.
  }
  return false;
};

const readSources = () => {
  const out = new Map();
  for (const file of REGISTRIES) {
    if (!fs.existsSync(file)) continue;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const s of [...(data.sources || []), ...(data.officialSources || [])]) {
      if (!s.url || !/^https?:\/\//i.test(s.url)) continue;
      const u = new URL(s.url);
      if (u.username || u.password || u.port && !['80','443'].includes(u.port)) continue;
      if (badHost(u.hostname)) continue;
      out.set(s.id || s.nameAr || s.url, { ...s, url: u.toString() });
    }
  }
  return [...out.entries()].map(([id, source]) => ({ id, ...source }));
};

async function fetchSafely(source) {
  let current = new URL(source.url);
  const originalHost = current.hostname.toLowerCase();
  if (current.protocol !== 'https:' || badHost(originalHost)) throw new Error('unsafe initial URL');

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const response = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': UA, accept: 'text/html,application/json,application/pdf,text/plain,*/*' }
    });

    if (response.status >= 300 && response.status < 400) {
      if (redirect === MAX_REDIRECTS) throw new Error('redirect limit exceeded');
      const location = response.headers.get('location');
      if (!location) throw new Error('redirect without location');
      const next = new URL(location, current);
      if (next.protocol !== 'https:' || next.username || next.password || (next.port && !['443'].includes(next.port))) {
        throw new Error('unsafe redirect target');
      }
      if (badHost(next.hostname) || next.hostname.toLowerCase() !== originalHost) {
        throw new Error('redirect leaves registered source host');
      }
      current = next;
      continue;
    }

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const length = Number(response.headers.get('content-length') || 0);
    if (length > MAX_BYTES) throw new Error('response exceeds size limit');

    const reader = response.body?.getReader();
    if (!reader) throw new Error('missing response body');
    const hash = crypto.createHash('sha256');
    let bytes = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        throw new Error('response exceeds streaming size limit');
      }
      hash.update(value);
    }
    return {
      status: response.status,
      finalUrl: current.toString(),
      contentType: response.headers.get('content-type') || 'unknown',
      bytes,
      sha256: hash.digest('hex')
    };
  }
}

const sources = readSources();
const results = [];
for (const source of sources) {
  try {
    const result = await fetchSafely(source);
    results.push({ id: source.id, url: source.url, role: source.role || null, status: 'verified', checkedAt: new Date().toISOString(), ...result });
    console.log(`VERIFIED ${source.id} ${result.status} ${result.bytes} bytes`);
  } catch (error) {
    results.push({ id: source.id, url: source.url, role: source.role || null, status: 'blocked', checkedAt: new Date().toISOString(), error: error.message });
    console.error(`BLOCKED ${source.id}: ${error.message}`);
  }
}

const blocked = results.filter(x => x.status !== 'verified');
fs.mkdirSync('artifacts/source-refresh', { recursive: true });
fs.writeFileSync('artifacts/source-refresh/manifest.json', JSON.stringify({
  schemaVersion: 1,
  policy: 'observe-only; never overwrite authoritative Corpus',
  generatedAt: new Date().toISOString(),
  sourceCount: results.length,
  verifiedCount: results.length - blocked.length,
  blockedCount: blocked.length,
  sources: results
}, null, 2) + '\n');

if (blocked.length) {
  console.error(`Source refresh gate blocked ${blocked.length}/${results.length} source(s). Previous verified data must remain authoritative.`);
  process.exit(1);
}
