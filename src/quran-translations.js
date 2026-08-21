const QURANENC_BASE = "https://quranenc.com/api/v1";
const QF_BASE = "https://apis.quran.foundation/content/api/v4";

function qfConfigured() {
  return Boolean(process.env.QF_CLIENT_ID && process.env.QF_CLIENT_SECRET);
}

let qfToken = null;
let qfTokenExpiresAt = 0;

async function qfAccessToken() {
  if (!qfConfigured()) return null;
  if (qfToken && Date.now() < qfTokenExpiresAt - 60_000) return qfToken;

  const authBase = process.env.QF_ENV === "production"
    ? "https://oauth2.quran.foundation"
    : "https://prelive-oauth2.quran.foundation";
  const credentials = Buffer.from(`${process.env.QF_CLIENT_ID}:${process.env.QF_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${authBase}/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${credentials}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials&scope=content"
  });
  if (!response.ok) throw new Error(`Quran Foundation token request failed: ${response.status}`);
  const data = await response.json();
  qfToken = data.access_token;
  qfTokenExpiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
  return qfToken;
}

async function qfRequest(path) {
  const token = await qfAccessToken();
  if (!token) return null;
  const response = await fetch(`${QF_BASE}${path}`, {
    headers: {
      "x-auth-token": token,
      "x-client-id": process.env.QF_CLIENT_ID
    }
  });
  if (!response.ok) throw new Error(`Quran Foundation request failed: ${response.status}`);
  return response.json();
}

export async function listQuranTranslations(language) {
  // QuranEnc is a useful public translation catalogue and fallback source.
  const url = language
    ? `${QURANENC_BASE}/translations/list/${encodeURIComponent(language)}/?localization=${encodeURIComponent(language)}`
    : `${QURANENC_BASE}/translations/list`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`QuranEnc translation catalogue failed: ${response.status}`);
  const quranEnc = await response.json();

  let qf = null;
  if (qfConfigured()) {
    try {
      qf = await qfRequest(`/resources/translations${language ? `?language=${encodeURIComponent(language)}` : ""}`);
    } catch (error) {
      console.warn(error.message);
    }
  }

  return { quranEnc, quranFoundation: qf?.translations || [] };
}

export async function getQuranTranslation({ translationKey, surah, ayah }) {
  if (!translationKey || !Number.isInteger(Number(surah))) throw new Error("translationKey and surah are required");
  const endpoint = ayah == null
    ? `/translation/sura/${encodeURIComponent(translationKey)}/${Number(surah)}`
    : `/translation/aya/${encodeURIComponent(translationKey)}/${Number(surah)}/${Number(ayah)}`;
  const response = await fetch(`${QURANENC_BASE}${endpoint}`);
  if (!response.ok) throw new Error(`QuranEnc translation request failed: ${response.status}`);
  return response.json();
}

export async function getQuranFoundationTranslation({ translationId, verseKey, chapterNumber }) {
  if (!qfConfigured()) return null;
  if (!translationId) throw new Error("translationId is required");
  const params = new URLSearchParams({ fields: "verse_key,verse_number,chapter_id,resource_name,language_name,id" });
  if (verseKey) params.set("verse_key", verseKey);
  if (chapterNumber) params.set("chapter_number", String(chapterNumber));
  return qfRequest(`/translations/${Number(translationId)}?${params}`);
}
