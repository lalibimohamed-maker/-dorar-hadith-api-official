let generator = null;

function assertLocalModule(url) {
  const parsed = new URL(url, self.location.href);
  if (!["https:", "http:", "file:"].includes(parsed.protocol)) {
    throw new Error("LOCAL_MODEL_MODULE_PROTOCOL_REJECTED");
  }
  if (parsed.protocol !== "file:" && parsed.origin !== self.location.origin) {
    throw new Error("REMOTE_MODEL_MODULE_REJECTED");
  }
}

self.addEventListener("message", async event => {
  const message = event.data ?? {};
  try {
    if (message.type === "init") {
      const moduleUrl = String(message.module_url ?? "");
      assertLocalModule(moduleUrl);
      const module = await import(moduleUrl);
      if (typeof module.createGenerator !== "function") {
        throw new Error("LOCAL_GENERATOR_FACTORY_MISSING");
      }
      generator = await module.createGenerator(message.options ?? {});
      self.postMessage({ id: message.id ?? null, ok: true, type: "ready" });
      return;
    }

    if (message.type === "generate") {
      if (!generator || typeof generator.generate !== "function") {
        throw new Error("LOCAL_GENERATOR_NOT_INITIALIZED");
      }
      const result = await generator.generate(message.request ?? {});
      self.postMessage({ id: message.id ?? null, ok: true, type: "result", result });
      return;
    }

    throw new Error("WORKER_MESSAGE_UNSUPPORTED");
  } catch (error) {
    self.postMessage({
      id: message.id ?? null,
      ok: false,
      type: "error",
      error: String(error?.message ?? error)
    });
  }
});
