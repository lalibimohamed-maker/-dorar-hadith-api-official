import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const policy = JSON.parse(fs.readFileSync(path.join(root, "..", "config", "library-access-policy-2026.json"), "utf8"));

export function getLibraryAccessPolicy() {
  return JSON.parse(JSON.stringify(policy));
}

export function accessModeForRights(status) {
  const value = String(status || "rights-unclear");
  if (["redistributable", "public-domain", "waqf-explicit"].includes(value)) return "redistributable";
  if (["read-only", "read-copy", "rights-restricted"].includes(value)) return "reference-only";
  return "external-reader";
}

export function buildBookDeliveryPolicy({ rightsStatus, sourceTerms = {} } = {}) {
  const mode = accessModeForRights(rightsStatus);
  const base = policy.packageModes[mode];
  return {
    mode,
    download: Boolean(base?.download) && sourceTerms.download !== false,
    offlineBundle: Boolean(base?.offlineBundle) && sourceTerms.offlineBundle !== false,
    reader: Boolean(base?.reader),
    search: Boolean(base?.search),
    copy: mode === "reference-only" && sourceTerms.copy !== false ? "citation-bounded" : false,
    sourceAttribution: true,
    formats: base?.formats || [],
    reason: mode === "redistributable"
      ? "rights-cleared-for-offline-redistribution"
      : mode === "reference-only"
        ? "reference-access-without-offline-redistribution"
        : "rights-not-established-for-local-copy"
  };
}

export function canOfferOfflineDownload({ rightsStatus, sourceTerms = {} } = {}) {
  return buildBookDeliveryPolicy({ rightsStatus, sourceTerms }).download === true;
}

export function canOfferAcademicQuote({ rightsStatus, sourceTerms = {} } = {}) {
  const delivery = buildBookDeliveryPolicy({ rightsStatus, sourceTerms });
  return delivery.mode === "reference-only" && delivery.copy === "citation-bounded";
}
