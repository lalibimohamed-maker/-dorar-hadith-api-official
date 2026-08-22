import sources from "../config/rijal-sources.json" with { type: "json" };
import schema from "../config/rijal-schema.json" with { type: "json" };
import methodology from "../config/rijal-methodology.json" with { type: "json" };

export function narratorProfile(narrator, judgments = [], links = []) {
  return {
    narrator,
    judgments: judgments.map((j) => ({ ...j, verification: j.verification || "unverified" })),
    network: {
      teachers: links.filter((x) => x.type === "teacher"),
      students: links.filter((x) => x.type === "student"),
      narratedFrom: links.filter((x) => x.type === "narrated-from"),
      narratedBy: links.filter((x) => x.type === "narrated-by")
    },
    methodology,
    sourceCatalog: sources.sources,
    schema
  };
}

export function buildIsnadGraph(nodes = [], edges = []) {
  return {
    nodes,
    edges,
    edgeTypes: schema.relationship.types,
    verificationLevels: schema.relationship.verification,
    policy: "لا تُستنتج صحة الإسناد أو الحديث من الرسم البياني وحده؛ الرسم يعرض العلاقات الموثقة ومستوى توثيقها."
  };
}
