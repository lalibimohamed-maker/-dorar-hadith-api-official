const BASE = process.env.QF_ENV === "production"
  ? "https://apis.quran.foundation/content/api/v4"
  : "https://apis-prelive.quran.foundation/content/api/v4";
const AUTH = process.env.QF_ENV === "production"
  ? "https://oauth2.quran.foundation"
  : "https://prelive-oauth2.quran.foundation";

let token;
let expiresAt = 0;

async function accessToken() {
  if (!process.env.QF_CLIENT_ID || !process.env.QF_CLIENT_SECRET) {
    const error = new Error("Quran Foundation credentials are not configured");
    error.code = "QF_NOT_CONFIGURED";
    throw error;
  }
  if (token && Date.now() < expiresAt - 60000) return token;
  const credentials = Buffer.from(`${process.env.QF_CLIENT_ID}:${process.env.QF_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${AUTH}/oauth2/token`, {
    method: "POST",
    headers: { authorization: `Basic ${credentials}`, "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=content"
  });
  if (!response.ok) throw new Error(`Quran Foundation token request failed: ${response.status}`);
  const data = await response.json();
  token = data.access_token;
  expiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
  return token;
}

async function qfGet(path, params) {
  const response = await fetch(`${BASE}${path}?${params}`, {
    headers: { "x-auth-token": await accessToken(), "x-client-id": process.env.QF_CLIENT_ID }
  });
  if (!response.ok) throw new Error(`Quran Foundation request failed: ${response.status}`);
  return response.json();
}

async function getTafsirs(verseKey, tafsirIds) {
  if (!tafsirIds.length) return [];
  const results = await Promise.all(tafsirIds.map(async (resourceId) => {
    const params = new URLSearchParams({ fields: "verse_key,resource_name,language_name,language_id,id" });
    const data = await qfGet(`/tafsirs/${resourceId}/by_ayah/${encodeURIComponent(verseKey)}`, params);
    const item = data?.tafsir;
    if (!item) return null;
    return {
      resourceId: item.resource_id,
      resourceName: item.resource_name,
      languageId: item.language_id,
      languageName: item.translated_name?.language_name || item.language_name,
      slug: item.slug,
      text: item.text,
      type: "tafsir"
    };
  }));
  return results.filter(Boolean);
}

export async function getQuranAyah({ verseKey, translationIds = [], tafsirIds = [], language = "en", words = false }) {
  if (!/^\d{1,3}:\d{1,3}$/.test(String(verseKey || ""))) {
    throw new Error("verseKey must be in surah:ayah form, e.g. 1:1");
  }
  const params = new URLSearchParams({
    fields: "verse_key,verse_number,text_uthmani,text_uthmani_simple,page_number,juz_number,hizb_number,ruku_number",
    language,
    words: words ? "true" : "false"
  });
  if (translationIds.length) params.set("translations", translationIds.join(","));

  const data = await qfGet(`/verses/by_key/${encodeURIComponent(verseKey)}`, params);
  const verse = data?.verses?.[0];
  if (!verse) return null;

  const tafsirs = await getTafsirs(verseKey, tafsirIds);

  return {
    verseKey: verse.verse_key,
    original: { script: "uthmani", text: verse.text_uthmani, simpleText: verse.text_uthmani_simple },
    translations: (verse.translations || []).map((item) => ({
      resourceId: item.resource_id,
      resourceName: item.resource_name,
      text: item.text,
      footnotes: item.foot_notes || null,
      type: "meaning-translation"
    })),
    tafsirs,
    context: {
      revelationContext: null,
      asbabAlNuzul: null,
      note: "Context and causes of revelation are populated only from separately verified sources; absence here does not mean that no source exists."
    },
    related: { hadith: [], sirahEvents: [] },
    words: words ? verse.words || [] : undefined,
    metadata: { page: verse.page_number, juz: verse.juz_number, hizb: verse.hizb_number, ruku: verse.ruku_number },
    policy: "The Arabic Quran text is original source text. Translations convey meanings and are displayed with attribution. Tafsir, revelation context, hadith and sirah are separate evidence types."
  };
}
