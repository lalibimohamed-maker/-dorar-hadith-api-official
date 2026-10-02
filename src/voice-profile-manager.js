const STATES = Object.freeze(["draft","consented","active","revoked"]);

export function createVoiceProfileManager({ storage = new Map() } = {}) {
  if (!storage || typeof storage.get !== "function" || typeof storage.set !== "function" || typeof storage.delete !== "function") {
    throw new TypeError("storage must expose get/set/delete");
  }

  function key(id) {
    if (!id) throw new TypeError("profile id is required");
    return `voice-profile:${id}`;
  }

  function create({ id, owner, purpose = "assistant-voice", language = "ar", source = "user-provided" } = {}) {
    if (!id || !owner) throw new TypeError("id and owner are required");
    if (purpose === "quran-recitation") {
      throw new Error("synthetic voice profiles are not permitted for Quran recitation");
    }
    const existing = storage.get(key(id));
    if (existing) throw new Error("voice profile already exists");
    const profile = Object.freeze({
      id: String(id),
      owner: String(owner),
      purpose: String(purpose),
      language: String(language),
      source: String(source),
      state: "draft",
      consentRecorded: false,
    });
    storage.set(key(id), profile);
    return profile;
  }

  function recordConsent(id, consent = false) {
    const profile = storage.get(key(id));
    if (!profile) throw new Error("unknown voice profile");
    if (consent !== true) throw new Error("explicit voice consent is required");
    const next = Object.freeze({ ...profile, consentRecorded: true, state: "consented" });
    storage.set(key(id), next);
    return next;
  }

  function activate(id) {
    const profile = storage.get(key(id));
    if (!profile) throw new Error("unknown voice profile");
    if (profile.consentRecorded !== true) throw new Error("voice profile cannot activate without consent");
    const next = Object.freeze({ ...profile, state: "active" });
    storage.set(key(id), next);
    return next;
  }

  function revoke(id) {
    const profile = storage.get(key(id));
    if (!profile) throw new Error("unknown voice profile");
    storage.delete(key(id));
    return Object.freeze({ ...profile, state: "revoked", deleted: true });
  }

  function get(id) {
    return storage.get(key(id)) || null;
  }

  return Object.freeze({ states: STATES, create, recordConsent, activate, revoke, get });
}
