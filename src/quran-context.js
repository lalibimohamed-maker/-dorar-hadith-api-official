import { listSirahEvents } from "./sirah-catalog.js";
import { findHadithLinksForAyah } from "./quran-hadith-links.js";

export async function getQuranContext({ verseKey, verseText, signal } = {}) {
  const events = listSirahEvents({ quranKey: verseKey }).map((event) => ({
    id: event.id,
    name: event.name,
    relationshipType: "sirah-event-related",
    confidence: "supported",
    sourceCitations: event.sources,
  }));

  let hadith = [];
  if (verseText) {
    try { hadith = await findHadithLinksForAyah(verseText, { signal }); }
    catch { hadith = []; }
  }

  return {
    revelationCause: [],
    revelationContext: [],
    hadith,
    sirahEvents: events,
    policy: {
      revelationCauseRequiresSource: true,
      aiInferenceMustBeLabeled: true,
      hadithRelationsAreCandidatesUntilVerified: true,
    },
  };
}
