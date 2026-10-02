export function createVoiceAgentBindingStore({ profileStore = null, storage = new Map() } = {}) {
  if (!storage || typeof storage.get !== "function" || typeof storage.set !== "function" || typeof storage.delete !== "function") {
    throw new TypeError("storage must expose get/set/delete");
  }

  function key(clientId) {
    if (!clientId) throw new TypeError("clientId is required");
    return `voice-agent:${clientId}`;
  }

  function bind({ clientId, profileId } = {}) {
    if (!profileId) throw new TypeError("profileId is required");
    if (profileStore) {
      const profile = profileStore.get(profileId);
      if (!profile) throw new Error("unknown voice profile");
      if (profile.state !== "active" || profile.consentRecorded !== true) {
        throw new Error("voice profile must be consented and active");
      }
    }
    const binding = Object.freeze({
      clientId: String(clientId),
      profileId: String(profileId),
      createdAt: new Date().toISOString(),
    });
    storage.set(key(clientId), binding);
    return binding;
  }

  function resolve(clientId, explicitProfileId = null) {
    if (explicitProfileId) {
      if (profileStore) {
        const profile = profileStore.get(explicitProfileId);
        if (!profile || profile.state !== "active" || profile.consentRecorded !== true) {
          throw new Error("explicit voice profile is not active and consented");
        }
      }
      return String(explicitProfileId);
    }
    return storage.get(key(clientId))?.profileId || null;
  }

  function unbind(clientId) {
    storage.delete(key(clientId));
    return { clientId: String(clientId), unbound: true };
  }

  return Object.freeze({ bind, resolve, unbind });
}
