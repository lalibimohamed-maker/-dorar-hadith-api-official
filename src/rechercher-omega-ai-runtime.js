/**
 * Rechercher Ω — concrete multimodal AI execution graphs.
 *
 * The graph is the bridge between the capability registry and actual worker
 * runtimes. It does not execute arbitrary third-party code and it never writes
 * generated material into the scholarly Corpus.
 */

const LOCAL_FIRST_INTEGRATIONS = new Set([
  "local_runtime",
  "gpu_runtime",
  "local_or_gpu_runtime",
  "runtime_acceleration",
  "openai_compatible"
]);

const DEFAULT_TOOLS = Object.freeze([
  "source_search",
  "source_metadata",
  "pdf_inspection",
  "ocr",
  "evidence_retrieval",
  "rights_check",
  "provenance"
]);

export function buildAiExecutionGraph(registry, {
  pipeline,
  availableComponents = [],
  disabledComponents = [],
  requestedTools = DEFAULT_TOOLS
} = {}) {
  const definition = registry.pipelines?.[pipeline];
  if (!definition) throw new Error("unknown AI pipeline: " + pipeline);

  const available = new Set(availableComponents);
  const disabled = new Set(disabledComponents);
  const nodes = [];

  for (const stage of definition.stages ?? []) {
    const choices = registry.components.filter(component =>
      component.id === stage ||
      component.tasks.includes(stage)
    );

    const candidates = choices.filter(component =>
      !disabled.has(component.id) &&
      (available.size === 0 || available.has(component.id))
    );

    if (!candidates.length && stage.includes("_or_")) {
      const alternatives = stage.split("_or_").filter(id => !disabled.has(id));
      for (const id of alternatives) {
        const component = registry.components.find(item => item.id === id);
        if (component && (available.size === 0 || available.has(id))) candidates.push(component);
      }
    }

    nodes.push({
      stage,
      required: !stage.startsWith("optional_"),
      candidates: candidates.map(component => ({
        id: component.id,
        integration: component.integration,
        local_first: LOCAL_FIRST_INTEGRATIONS.has(component.integration),
        model_license_status: component.model_license_status
      }))
    });
  }

  const toolSet = [...new Set(requestedTools)].filter(Boolean);
  return {
    schema_version: "1.0.0",
    engine: "rechercher-omega",
    pipeline,
    nodes,
    tools: toolSet,
    policy: {
      fail_closed: true,
      local_first: true,
      arbitrary_third_party_execution: false,
      generated_media_is_evidence: false,
      corpus_write_allowed: false
    }
  };
}

export function buildMcpToolPolicy(requestedTools = DEFAULT_TOOLS) {
  const allow = [...new Set(requestedTools)].filter(Boolean);
  const denied = [
    "unrestricted_shell",
    "credential_read",
    "secret_search",
    "arbitrary_repository_write",
    "raw_external_code_execution"
  ];
  return {
    schema_version: "1.0.0",
    protocol: "mcp",
    allow,
    deny: denied,
    confirmation_required: [
      "public_publication",
      "rights_promotion",
      "repository_write",
      "destructive_operation"
    ],
    audit_required: true,
    credentials: "environment_or_secret_manager_only"
  };
}

export function buildProgrammingGraph(registry) {
  const graph = buildAiExecutionGraph(registry, {
    pipeline: "programming",
    requestedTools: [
      "repository_read",
      "repository_search",
      "patch_proposal",
      "test",
      "lint",
      "typecheck",
      "build"
    ]
  });
  return {
    ...graph,
    role: "programming",
    code_policy: {
      inspect_before_write: true,
      smallest_scoped_change: true,
      tests_required: true,
      secrets_never_written_to_source: true,
      human_review_for_publication: true
    }
  };
}
