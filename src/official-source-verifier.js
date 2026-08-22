import registry from "../config/official-institution-sources.json" with { type: "json" };

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

export function listOfficialSources({ country, capability } = {}) {
  return registry.sources.filter((source) =>
    (!country || source.country === country) &&
    (!capability || source.capabilities.includes(capability))
  );
}

export function matchOfficialSource(url) {
  const target = normalize(url);
  if (!target) return null;
  return registry.sources.find((source) => target.startsWith(normalize(source.url))) || null;
}

export function buildOfficialEvidence({ narratorId, url, title = null, quote = null, location = null, accessedAt = null } = {}) {
  const source = matchOfficialSource(url);
  return {
    narratorId: narratorId || null,
    sourceId: source?.id || null,
    sourceType: source?.institutionType || "external",
    url: url || null,
    title,
    quote,
    location,
    accessedAt,
    role: "secondary-supporting-reference",
    verification: "unverified",
    policy: registry.policy,
    note: "لا يُنشئ هذا الدليل حكم جرح أو تعديل، ولا يغيّر حكم ناقد، ولا يرفع المادة إلى verified تلقائيًا."
  };
}

export function rankEvidenceForRijal(primaryEvidence = [], officialEvidence = []) {
  return {
    primary: primaryEvidence,
    secondaryOfficial: officialEvidence,
    ordering: ["primary-rijal", "early-classical", "comparative", "official-secondary", "academic-secondary"],
    rule: "المصدر الرسمي يُستخدم للمساندة والتحقق من الهوية والسياق والفهرسة، ولا يُعامل كمصدر حكم رجالي إلا إذا كان ينقل نصًا أصليًا يمكن توثيقه مستقلاً."
  };
}

export function getOfficialSourcePolicy() {
  return registry.policy;
}
