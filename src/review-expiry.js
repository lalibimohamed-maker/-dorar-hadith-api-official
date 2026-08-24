const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function isExpired(createdAt, now = Date.now(), maxAgeMs = MAX_AGE_MS) {
  const t = Date.parse(createdAt || "");
  return !Number.isFinite(t) || now - t > maxAgeMs;
}

export function expireReview(item, now = Date.now()) {
  if (!item || item.state !== "pending") return item;
  if (!isExpired(item.createdAt, now)) return item;
  return Object.freeze({ ...item, state: "expired", decision: null });
}

export function canDecideExpired(item) {
  return Boolean(item && item.state === "pending" && !isExpired(item.createdAt));
}
