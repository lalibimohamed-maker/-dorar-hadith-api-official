const ALLOWED_OPERATIONS = Object.freeze(new Set([
  "health", "list-engines", "list-voices", "transcribe", "synthesize"
]));

export function isVoiceMcpOperationAllowed(operation) {
  return ALLOWED_OPERATIONS.has(String(operation || ""));
}
export function assertVoiceMcpOperation(operation) {
  if (!isVoiceMcpOperationAllowed(operation)) throw new Error("Blocked Al-Huda voice MCP operation: " + operation);
  return String(operation);
}
export function listAllowedVoiceMcpOperations() { return [...ALLOWED_OPERATIONS]; }