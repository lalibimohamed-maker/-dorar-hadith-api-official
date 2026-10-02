const OPERATIONS = Object.freeze([
  "health",
  "list-engines",
  "list-voices",
  "list-languages",
  "transcribe",
  "synthesize",
]);

const BLOCKED = Object.freeze([
  "modify-corpus",
  "publish-source-content",
  "bypass-rights-gates",
  "clone-quran-recitation-voice",
]);

export function createAlHudaAgentTools({ providers = {}, onAudit = () => {} } = {}) {
  function assertOperation(operation) {
    if (!OPERATIONS.includes(operation)) {
      if (BLOCKED.includes(operation)) throw new Error(`blocked Al-Huda operation: ${operation}`);
      throw new Error(`unknown Al-Huda operation: ${operation}`);
    }
  }

  async function execute(operation, input = {}) {
    assertOperation(operation);
    const map = {
      health: providers.health,
      "list-engines": providers.listEngines,
      "list-voices": providers.listVoices,
      "list-languages": providers.listLanguages,
      transcribe: providers.transcribe,
      synthesize: providers.synthesize,
    };
    const fn = map[operation];
    if (typeof fn !== "function") throw new Error(`Al-Huda provider is not configured: ${operation}`);
    const result = await fn(input);
    const audit = Object.freeze({
      assistant: "Al-Huda",
      operation,
      corpusMutation: false,
      rightsBypass: false,
      timestamp: new Date().toISOString(),
    });
    onAudit(audit);
    return { result, audit };
  }

  return Object.freeze({
    operations: OPERATIONS,
    blockedOperations: BLOCKED,
    execute,
  });
}
