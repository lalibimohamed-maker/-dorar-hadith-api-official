import { createHash } from "node:crypto";

const ALLOWED_EVENTS = new Set([
  "source-discovered","source-verified","source-refreshed","source-quarantined",
  "rights-reviewed","edition-recorded","restore-selected"
]);

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

export function createAuditEvent({ event, sourceId = null, revisionId = null, actor = "system", reason = null, timestamp = null, metadata = {} } = {}) {
  if (!ALLOWED_EVENTS.has(event)) throw new Error("unsupported audit event");
  const safeMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([k]) => !/(token|secret|password|authorization|cookie|api[_-]?key)/i.test(k))
  );
  const body = { schemaVersion: 1, event, sourceId, revisionId, actor, reason, timestamp: timestamp || new Date().toISOString(), metadata: safeMetadata };
  return Object.freeze({ ...body, eventId: digest(body) });
}

export function appendAuditEvent(log = [], event) {
  if (!event?.eventId) throw new Error("eventId is required");
  if (log.some(x => x.eventId === event.eventId)) return Object.freeze([...log]);
  return Object.freeze([...log, Object.freeze(event)]);
}

export function verifyAuditLog(log = []) {
  return log.every(event => event?.eventId === digest({
    schemaVersion: event.schemaVersion,
    event: event.event,
    sourceId: event.sourceId,
    revisionId: event.revisionId,
    actor: event.actor,
    reason: event.reason,
    timestamp: event.timestamp,
    metadata: event.metadata
  }));
}
