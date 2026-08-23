import test from 'node:test';
import assert from 'node:assert/strict';
import { createAlQuranCloudRecitationProvider } from '../src/quran-recitation-source.js';

function response(payload, ok = true, status = 200) {
  return {
    ok,
    status,
    async json() { return payload; },
  };
}

test('Al Quran Cloud provider returns explicit audio provenance', async () => {
  const provider = createAlQuranCloudRecitationProvider({
    edition: 'ar.alafasy',
    fetchImpl: async url => {
      assert.match(url, /\/ayah\/1\/ar\.alafasy$/);
      return response({
        data: {
          number: 1,
          numberInSurah: 1,
          surah: { number: 1 },
          audio: 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3',
          edition: { identifier: 'ar.alafasy', name: 'Mishary Rashid Alafasy' },
        },
      });
    },
  });

  const result = await provider.execute({ ayah: 1, verifiedOnly: true });
  assert.equal(result.domain, 'quran-recitation');
  assert.equal(result.reciter, 'Mishary Rashid Alafasy');
  assert.equal(result.source, 'Al Quran Cloud');
  assert.equal(result.verified, true);
  assert.match(result.audioUrl, /^https:\/\//);
  assert.equal(result.provenance.edition, 'ar.alafasy');
});

test('provider rejects unverified recitation requests', async () => {
  const provider = createAlQuranCloudRecitationProvider({ fetchImpl: async () => { throw new Error('must not fetch'); } });
  await assert.rejects(() => provider.execute({ ayah: 1, verifiedOnly: false }), /verifiedOnly=true/);
});

test('provider rejects incomplete provider audio metadata', async () => {
  const provider = createAlQuranCloudRecitationProvider({
    fetchImpl: async () => response({ data: { number: 1, audio: null, edition: {} } }),
  });
  await assert.rejects(() => provider.execute({ ayah: 1 }), /incomplete Quran recitation provenance/);
});
