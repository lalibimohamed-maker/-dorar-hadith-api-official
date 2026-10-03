export function createNativeDictationSession({ transport } = {}) {
  const required = ["createSession", "insertText", "cancelSession"];
  for (const name of required) {
    if (typeof transport?.[name] !== "function") throw new TypeError(`transport.${name} is required`);
  }

  let sessionId = null;
  let active = false;

  return Object.freeze({
    get active() { return active; },
    get sessionId() { return sessionId; },

    async start() {
      if (active) throw new Error("dictation session already active");
      const result = await transport.createSession();
      if (!result?.id) throw new Error("dictation transport returned no session id");
      sessionId = String(result.id);
      active = true;
      return Object.freeze({ id: sessionId, active: true });
    },

    async insert(text) {
      if (!active || !sessionId) throw new Error("dictation session is not active");
      const value = String(text ?? "").trim();
      if (!value) throw new Error("dictation text must not be empty");
      return transport.insertText(sessionId, value);
    },

    async cancel() {
      if (!active || !sessionId) return { cancelled: false };
      const id = sessionId;
      try {
        await transport.cancelSession(id);
      } finally {
        active = false;
        sessionId = null;
      }
      return { cancelled: true, id };
    },
  });
}
