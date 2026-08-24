const REDISTRIBUTABLE = new Set(["redistributable", "licensed", "public-domain"]);
const COPY_ALLOWED = new Set(["redistributable", "licensed", "public-domain", "read-only", "link-only"]);

export const READER_ACCESS = Object.freeze({
  READ: "read",
  COPY_TEXT: "copy-text",
  REDISTRIBUTE: "redistribute"
});

export function evaluateReaderAccess({ rights, sourceAllowsReading = false, sourceAllowsCopy = false }) {
  const status = rights?.status;
  const canRead = REDISTRIBUTABLE.has(status) || (sourceAllowsReading && COPY_ALLOWED.has(status));
  const canCopyText = REDISTRIBUTABLE.has(status) || (sourceAllowsCopy && COPY_ALLOWED.has(status));
  const canRedistribute = REDISTRIBUTABLE.has(status);

  return Object.freeze({
    canRead,
    canCopyText,
    canRedistribute,
    reason: canRead ? "source_and_rights_policy" : "reading_not_authorized"
  });
}
