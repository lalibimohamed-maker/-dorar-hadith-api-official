import { listSirahEvents } from "./sirah-catalog.js";
import { findHadithLinksForAyah } from "./quran-hadith-links.js";
import { getKnowledgeContext } from "./knowledge-context.js";

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

  const knowledge = getKnowledgeContext({ verseKey });

  return {
    revelationCause: [],
    revelationContext: [],
    hadith,
    sirahEvents: events,
    knowledge,
    policy: {
      revelationCauseRequiresSource: true,
      aiInferenceMustBeLabeled: true,
      hadithRelationsAreCandidatesUntilVerified: true,
      sirahSourceDoesNotImplyNarrationAuthenticity: true,
      originalArabicQuranMustNotBeReplacedByTranslation: true,
    },
  };
}
