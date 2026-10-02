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
    const effectiveInput = operation === "synthesize" && voiceBindings
      ? { ...input, resolvedProfileId: voiceBindings.resolve(input.clientId, input.profileId) }
      : input;
    const result = await fn(effectiveInput);
    const audit = Object.freeze({
      assistant: "Al-Huda",
      operation,
      corpusMutation: false,
      rightsBypass: false,
      ...(operation === 'synthesize' && voiceBindings ? { voiceProfileId: effectiveInput.resolvedProfileId ?? null } : {}),
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