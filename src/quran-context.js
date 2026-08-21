import { listSirahEvents } from "./sirah-catalog.js";

export function getQuranContext(verseKey) {
  const events = listSirahEvents({ quranKey: verseKey }).map((event) => ({
    id: event.id,
    name: event.name,
    relationshipType: "sirah-event-related",
    confidence: "supported",
    sourceCitations: event.sources,
  }));

  return {
    revelationCause: [],
    revelationContext: [],
    hadith: [],
    sirahEvents: events,
    policy: {
      revelationCauseRequiresSource: true,
      aiInferenceMustBeLabeled: true,
    },
  };
}
