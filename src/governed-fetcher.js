const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "text/plain", "application/epub+zip"]);

export function planGovernedFetch({ connector, url, contentType, contentLength }) {
  const failures = [];
  if (!connector?.allowed) failures.push("connector_not_authorized");
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) failures.push("url_invalid");
  if (!ALLOWED_TYPES.has(contentType)) failures.push("content_type_not_allowed");
  if (!Number.isInteger(contentLength) || contentLength < 0 || contentLength > MAX_BYTES) failures.push("content_length_not_allowed");
  if (failures.length) return { allowed: false, state: "blocked", failures };
  return { allowed: true, state: "planned", failures: [] };
}

export const FETCH_LIMITS = Object.freeze({
  maxBytes: MAX_BYTES,
  allowedContentTypes: [...ALLOWED_TYPES]
});
