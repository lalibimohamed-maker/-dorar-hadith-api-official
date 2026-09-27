const REQUIRED_AXES = Object.freeze(["production","pre_live","auth","sdk","rights","provenance","adapter"]);
const RIGHTS_STATES = Object.freeze(new Set(["verified_public_domain","verified_license","source_permission","link_only","review_required","blocked"]));

export function validateScholarlyFleet(fleet = {}) {
  const errors = [];
  if (fleet.governance?.corpus_write_allowed === true) errors.push("corpus-write-enabled");

  const axes = new Set(fleet.contract?.required_axes ?? []);
  for (const axis of REQUIRED_AXES) {
    if (!axes.has(axis)) errors.push("missing-contract-axis:" + axis);
  }

  const families = Array.isArray(fleet.families) ? fleet.families : [];
  const familyIds = new Set();

  for (const family of families) {
    for (const field of ["id","label_ar","capabilities","sources"]) {
      if (family[field] == null || family[field] === "") errors.push("family-missing:" + field);
    }
    if (family.id && familyIds.has(family.id)) errors.push("duplicate-family:" + family.id);
    if (family.id) familyIds.add(family.id);

    for (const axis of REQUIRED_AXES) {
      if (family.contract?.[axis] == null || family.contract[axis] === "") {
        errors.push("family-missing-contract:" + family.id + ":" + axis);
      }
    }

    for (const source of family.sources ?? []) {
      for (const field of ["id","kind","execution"]) {
        if (source[field] == null || source[field] === "") {
          errors.push("source-missing:" + family.id + ":" + field);
        }
      }
      for (const axis of REQUIRED_AXES) {
        if (source.contract?.[axis] == null || source.contract[axis] === "") {
          errors.push("source-missing-contract-axis:" + family.id + ":" + source.id + ":" + axis);
        }
      }
      if (source.contract?.rights === "allow_all" || source.contract?.rights === "public_by_default") {
        errors.push("unsafe-rights-default:" + family.id + ":" + source.id);
      }
    }
  }

  if (families.length === 0) errors.push("no-families");
  return { valid: errors.length === 0, errors };
}

export function indexScholarlyFleet(fleet = {}) {
  const result = validateScholarlyFleet(fleet);
  if (!result.valid) throw new TypeError("Invalid Rechercher Ω scholarly fleet: " + result.errors.join(","));
  return new Map(fleet.families.map(family => [family.id, Object.freeze(structuredClone(family))]));
}

export function buildScholarlyAdapterRequest({ fleetIndex, familyId, sourceId, locator, rightsStatus, provenance = {} }) {
  const family = fleetIndex.get(familyId);
  if (!family) throw new Error("unknown scholarly family: " + familyId);
  const source = family.sources.find(item => item.id === sourceId);
  if (!source) throw new Error("unknown source " + sourceId + " in family " + familyId);
  if (!locator) throw new Error("source locator is required");
  if (!RIGHTS_STATES.has(rightsStatus)) throw new Error("unknown rights status: " + rightsStatus);

  return {
    family_id: familyId,
    source_id: sourceId,
    adapter: source.execution,
    locator,
    rights_status: rightsStatus,
    provenance: {
      source_id: sourceId,
      family_id: familyId,
      source_locator: locator,
      retrieved_at: provenance.retrieved_at ?? null,
      source_revision: provenance.source_revision ?? null,
      etag: provenance.etag ?? null,
      sha256: provenance.sha256 ?? null
    },
    corpus_write_allowed: false
  };
}

export function canPromoteToPublicDownload(rightsStatus) {
  return new Set(["verified_public_domain","verified_license","source_permission"]).has(rightsStatus);
}
