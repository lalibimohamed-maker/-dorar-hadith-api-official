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

const MODEL_BEARING_KINDS = /model|vlm|ocr|embedding|reranker|reasoning|speech_recognition|text_to_speech|generation|vision_language|multimodal/i;

const DEFAULT_TOOLS = Object.freeze([
  "source_search",
  "source_metadata",
  "pdf_inspection",
  "ocr",
  "evidence_retrieval",
  "rights_check",
  "provenance"
]);

function componentRuntimeEligibility(component, activationStates = {}) {
  if (!component || component.runtime_enabled === false) return false;
  const state = activationStates[component.id];
  if (MODEL_BEARING_KINDS.test(component.kind ?? "") && state !== undefined && state !== "active") return false;
  if (["architecture_reference", "reference_only"].includes(component.integration)) return false;
  if (component.model_license_status === "blocked") return false;
  if (MODEL_BEARING_KINDS.test(component.kind ?? "") && component.model_license_status === "review_required") return false;
  return true;
}

export function buildAiExecutionGraph(registry, {
  pipeline,
  availableComponents = [],
  disabledComponents = [],
  requestedTools = DEFAULT_TOOLS,
  activationStates = {}
} = {}) {
  const definition = registry.pipelines?.[pipeline];
  if (!definition) throw new Error("unknown AI pipeline: " + pipeline);

  const available = new Set(availableComponents);
  const disabled = new Set(disabledComponents);
  const nodes = [];

  for (const stage of definition.stages ?? []) {
    const choices = registry.components.filter(component =>
      component.id === stage || component.tasks.includes(stage)
    );

    let candidates = choices.filter(component =>
      !disabled.has(component.id) &&
      (available.size === 0 || available.has(component.id)) &&
      componentRuntimeEligibility(component, activationStates)
    );

    if (!candidates.length && stage.includes("_or_")) {
      const alternatives = stage.split("_or_").filter(id => !disabled.has(id));
      candidates = alternatives
        .map(id => registry.components.find(item => item.id === id))
        .filter(component =>
          component &&
          (available.size === 0 || available.has(component.id)) &&
          componentRuntimeEligibility(component)
        );
    }

    const allChoices = choices
      .filter(component => !disabled.has(component.id) && (available.size === 0 || available.has(component.id)))
      .map(component => ({
        id: component.id,
        runtime_eligible: componentRuntimeEligibility(component),
        integration: component.integration,
        local_first: LOCAL_FIRST_INTEGRATIONS.has(component.integration),
        model_license_status: component.model_license_status
      }));

    nodes.push({
      stage,
      required: !stage.startsWith("optional_"),
      candidates: candidates.map(component => ({
        id: component.id,
        integration: component.integration,
        local_first: LOCAL_FIRST_INTEGRATIONS.has(component.integration),
        model_license_status: component.model_license_status,
        runtime_eligible: true,
        activation_state: activationStates[component.id] ?? "not_supplied"
      })),
      rejected_candidates: allChoices.filter(candidate => !candidate.runtime_eligible)
    });
  }

  const toolSet = [...new Set(requestedTools)].filter(Boolean);
  return {
    schema_version: "1.1.0",
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
  const allow = [...new Set(requestedTools)]
    .filter(Boolean)
    .filter(tool => ![
      "unrestricted_shell",
      "credential_read",
      "secret_search",
      "arbitrary_repository_write",
      "raw_external_code_execution"
    ].includes(tool));

  const denied = [
    "unrestricted_shell",
    "credential_read",
    "secret_search",
    "arbitrary_repository_write",
    "raw_external_code_execution"
  ];

  return {
    schema_version: "1.1.0",
    protocol: "mcp",
    allow,
    deny: denied,
    unknown_tools_default: "deny",
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
