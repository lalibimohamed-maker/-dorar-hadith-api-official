/**
 * Verified Quran recitation source adapter.
 *
 * Uses Al Quran Cloud's public ayah-level audio API/CDN. The adapter never
 * invents an audio URL or a reciter name: both are taken from the provider
 * response and returned with explicit provenance metadata.
 *
 * Provider terms note that recitations are licensed for free non-commercial
 * redistribution/streaming and that copyrights remain with the reciters or
 * their estates. See: https://alquran.cloud/terms-and-conditions
 */

const API_BASE = 'https://api.alquran.cloud/v1';
const SOURCE_NAME = 'Al Quran Cloud';
const SOURCE_URL = 'https://alquran.cloud/';
const TERMS_URL = 'https://alquran.cloud/terms-and-conditions';
const DEFAULT_EDITION = 'ar.alafasy';
const MIN_AYAH = 1;
const MAX_AYAH = 6236;

function assertAyah(ayah) {
  const value = Number(ayah);
  if (!Number.isInteger(value) || value < MIN_AYAH || value > MAX_AYAH) {
    throw new RangeError(`ayah must be an integer between ${MIN_AYAH} and ${MAX_AYAH}`);
  }
  return value;
}

function pickAudio(data) {
  const candidates = [data?.audio, ...(Array.isArray(data?.audioSecondary) ? data.audioSecondary : [])];
  return candidates.find(value => typeof value === 'string' && /^https:\/\//.test(value)) || null;
}

function reciterFromEdition(edition = {}) {
  return edition.name || edition.englishName || edition.identifier || null;
}

export function createAlQuranCloudRecitationProvider({
  fetchImpl = globalThis.fetch,
  edition = DEFAULT_EDITION,
  apiBase = API_BASE,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required');
  if (!/^[a-z0-9._-]+$/.test(edition)) throw new TypeError('Invalid Quran audio edition');

  return Object.freeze({
    supports(capability) {
      return capability === 'quran-recitation';
    },

    async execute({ ayah, reciter, verifiedOnly = true } = {}) {
      if (!verifiedOnly) throw new Error('Quran recitation requires verifiedOnly=true');
      const number = assertAyah(ayah);
      const response = await fetchImpl(`${apiBase}/ayah/${number}/${encodeURIComponent(edition)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`Quran audio provider returned HTTP ${response.status}`);
      const payload = await response.json();
      const data = payload?.data || {};
      const audioUrl = pickAudio(data);
      const providerReciter = reciterFromEdition(data.edition);
      if (!audioUrl || !providerReciter) throw new Error('Provider returned incomplete Quran recitation provenance');
      if (reciter && reciter !== providerReciter) throw new Error('Requested reciter does not match the selected verified edition');

      return {
        domain: 'quran-recitation',
        ayah: data.numberInSurah || data.number || number,
        surah: data.surah?.number || null,
        audioUrl,
        source: SOURCE_NAME,
        sourceUrl: SOURCE_URL,
        termsUrl: TERMS_URL,
        reciter: providerReciter,
        edition,
        verified: true,
        provenance: {
          provider: SOURCE_NAME,
          providerUrl: SOURCE_URL,
          termsUrl: TERMS_URL,
          edition,
        },
      };
    },
  });
}

export const AL_QURAN_CLOUD_RECITATION = Object.freeze({
  source: SOURCE_NAME,
  sourceUrl: SOURCE_URL,
  termsUrl: TERMS_URL,
  defaultEdition: DEFAULT_EDITION,
});
