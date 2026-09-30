export function createPostHogObserver({
  host = process.env.POSTHOG_HOST,
  projectApiKey = process.env.POSTHOG_PROJECT_API_KEY,
  fetchImpl = globalThis.fetch
} = {}) {
  const enabled = Boolean(host && projectApiKey && typeof fetchImpl === "function");
  return Object.freeze({
    enabled,
    async capture(event, properties = {}) {
      if (!enabled) return { skipped: true, reason: "POSTHOG_NOT_CONFIGURED" };
      const response = await fetchImpl(host.replace(/\/$/, "") + "/capture/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ api_key: projectApiKey, event, properties })
      });
      if (!response.ok) throw new Error("PostHog capture HTTP " + response.status);
      return { captured: true };
    }
  });
}
