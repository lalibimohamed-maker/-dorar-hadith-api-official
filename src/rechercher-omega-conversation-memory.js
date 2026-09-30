import { createHash } from "node:crypto";

function digest(value) {
  return createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

export class ConversationMemory {
  constructor({ maxTurns = 20, maxCharsPerMessage = 12000, persistence = "volatile" } = {}) {
    if (!Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > 100) throw new RangeError("maxTurns must be between 1 and 100");
    if (!Number.isInteger(maxCharsPerMessage) || maxCharsPerMessage < 128 || maxCharsPerMessage > 50000) throw new RangeError("maxCharsPerMessage is out of range");
    if (persistence !== "volatile") throw new Error("persistent raw conversation memory is disabled by default");
    this.maxTurns = maxTurns;
    this.maxCharsPerMessage = maxCharsPerMessage;
    this.persistence = persistence;
    this.turns = [];
  }

  append({ role, content, timestamp = Date.now(), metadata = {} } = {}) {
    if (!["system", "user", "assistant", "tool"].includes(role)) throw new TypeError("invalid conversation role");
    if (typeof content !== "string") throw new TypeError("conversation content must be a string");
    const bounded = content.slice(0, this.maxCharsPerMessage);
    this.turns.push({
      role,
      content: bounded,
      timestamp,
      metadata: { ...metadata }
    });
    while (this.turns.length > this.maxTurns) this.turns.shift();
    return this.turns[this.turns.length - 1];
  }

  snapshot() {
    return this.turns.map(turn => ({ ...turn, metadata: { ...turn.metadata } }));
  }

  persistentSnapshot() {
    return this.turns.map(turn => ({
      role: turn.role,
      content_sha256: digest(turn.content),
      chars: turn.content.length,
      timestamp: turn.timestamp,
      metadata: { ...turn.metadata }
    }));
  }

  clear() {
    this.turns.length = 0;
  }

  get length() {
    return this.turns.length;
  }
}

export function buildConversationMemoryPolicy() {
  return {
    persistence: "volatile",
    raw_persistence_default: false,
    max_turns: 20,
    max_chars_per_message: 12000,
    user_export_requires_explicit_opt_in: true,
    secrets_in_memory_forbidden: true
  };
}
