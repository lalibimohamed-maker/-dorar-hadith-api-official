/**
 * Rechercher Ω — AI capability registry and pipeline planner.
 *
 * This module records reusable open-source capabilities without copying or
 * auto-executing third-party code. It sits above Corpus and never writes to it.
 */

const DEFAULT_REGISTRY = new URL("../config/rechercher-omega-ai-capabilities.json", import.meta.url);

export async function loadAICapabilityRegistry(url = DEFAULT_REGISTRY) {
  const fs = await import("node:fs/promises");
  return JSON.parse(await fs.readFile(url, "utf8"));
}

export function listCapabilities(registry, task) {
  return registry.components.filter(component => component.tasks.includes(task));
}

export function getCapability(registry, id) {
  return registry.components.find(component => component.id === id) ?? null;
}

function resolveStageChoice(registry, stage, overrides = {}) {
  const mappedOverride =
    (stage.startsWith("cosyvoice_or_") && overrides.tts) ||
    overrides[stage] ||
    null;

  if (mappedOverride && getCapability(registry, mappedOverride)) {
    return [getCapability(registry, mappedOverride)];
  }

  if (stage.includes("_or_")) {
    const alternatives = stage.split("_or_");
    const candidates = alternatives.map(id => getCapability(registry, id)).filter(Boolean);
    if (candidates.length) return [candidates[0]];
  }

  const direct = getCapability(registry, stage);
  return direct ? [direct] : [];
}

export function buildPipelinePlan(registry, pipeline, { overrides = {}, disabled = [] } = {}) {
  const definition = registry.pipelines?.[pipeline];
  if (!definition) throw new Error("unknown Rechercher Ω AI pipeline: " + pipeline);

  const disabledSet = new Set(disabled);
  const selected = [];

  for (const stage of definition.stages ?? []) {
    const choices = resolveStageChoice(registry, stage, overrides);
    for (const component of choices) {
      if (!disabledSet.has(component.id)) selected.push(component);
    }
  }

  const components = selected.filter(
    (component, index, array) => array.findIndex(item => item.id === component.id) === index
  );

  return {
    schema_version: "1.1.0",
    engine: "rechercher-omega",
    pipeline,
    components: components.map(component => ({
      id: component.id,
      kind: component.kind,
      integration: component.integration,
      code_license: component.code_license,
      model_license_status: component.model_license_status
    })),
    fail_closed: true,
    corpus_write_allowed: false,
    generated_media_is_evidence: false,
    external_code_auto_execution: false
  };
}

export function assertAICapabilityBoundary(plan) {
  if (plan.corpus_write_allowed) {
    throw new Error("Rechercher Ω AI capability boundary violation: Corpus writes are forbidden");
  }
  if (plan.generated_media_is_evidence) {
    throw new Error("Rechercher Ω AI capability boundary violation: generated media cannot be evidence");
  }
  if (plan.external_code_auto_execution) {
    throw new Error("Rechercher Ω AI capability boundary violation: external code cannot auto-execute");
  }
  return true;
}
