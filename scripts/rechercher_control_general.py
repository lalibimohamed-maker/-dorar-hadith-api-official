#!/usr/bin/env python3
"""Global control plane for Rechercher acquisition.

This is a fail-closed audit layer: it does not invent evidence, grant rights,
or publish anything. It verifies that every layer leaves machine-readable
provenance and that missing/weak layers become explicit HOLD/REVIEW states.
"""
import argparse, hashlib, json, re
from datetime import datetime, timezone
from pathlib import Path

REQUIRED = {
    "identity": ["work_id", "edition_id", "digital_copy_id"],
    "rights": ["rights_source", "rights_evidence", "rights_checked_at", "license", "redistribution_allowed"],
    "quality": ["quality_score"],
}


def load(path):
    p = Path(path)
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def now():
    return datetime.now(timezone.utc).isoformat()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--catalog", required=True)
    ap.add_argument("--overlay", required=True)
    ap.add_argument("--governance", required=True)
    ap.add_argument("--page-integrity", required=True)
    ap.add_argument("--publication-gate", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    root = Path(a.root).resolve()
    catalog = load(root / a.catalog) or {}
    overlay = load(root / a.overlay) or {}
    governance = load(root / a.governance) or {}
    pages = load(root / a.page_integrity) or {}
    gate = load(root / a.publication_gate) or {}

    entries = catalog.get("entries", catalog.get("books", []))
    overlay_entries = overlay.get("entries", [])
    checks = []
    gaps = []

    def check(name, ok, detail, severity="HIGH"):
        checks.append({"name": name, "status": "PASS" if ok else "HOLD", "severity": severity, "detail": detail})
        if not ok:
            gaps.append({"check": name, "severity": severity, "detail": detail})

    check("catalog-present", bool(entries), f"catalog entries={len(entries)}")
    check("overlay-present", bool(overlay_entries), f"overlay entries={len(overlay_entries)}")
    check("scope-1-400H", str(overlay.get("scope", "")).upper() in {"1-400H", "01-400H"}, str(overlay.get("scope")))

    # Identity separation: work/edition/digital-copy must not collapse into one field.
    identity_missing = 0
    rights_missing = 0
    quality_missing = 0
    for i, e in enumerate(entries):
        ident = e.get("identity", e)
        if not all(ident.get(k) for k in REQUIRED["identity"]):
            identity_missing += 1
        rights = e.get("rights", e)
        if not all(rights.get(k) not in (None, "") for k in REQUIRED["rights"]):
            rights_missing += 1
        if e.get("quality_score", e.get("quality", {}).get("score")) in (None, ""):
            quality_missing += 1
    check("identity-three-layer", identity_missing == 0, f"records missing Work/Edition/DigitalCopy IDs: {identity_missing}", "CRITICAL")
    check("rights-evidence", rights_missing == 0, f"records missing rights evidence fields: {rights_missing}", "CRITICAL")
    check("quality-score", quality_missing == 0, f"records missing quality score: {quality_missing}", "HIGH")

    health = overlay.get("engine_health", {})
    expected = {"waqfeya", "internet_archive", "openlibrary", "library_of_congress", "google_books", "crossref"}
    missing_engines = sorted(expected - set(health))
    check("six-core-source-health", not missing_engines and all(v.get("status") in {"up", "degraded"} for v in health.values()), json.dumps({"missing": missing_engines, "health": health}, ensure_ascii=False), "HIGH")

    # Page integrity and publication gate are independent; neither may be skipped.
    check("page-integrity", bool(pages) and "counts" in pages, "page-integrity report must exist")
    check("publication-gate", gate.get("status") in {"PUBLICATION_APPROVED", "HOLD"}, f"status={gate.get('status')}", "CRITICAL")

    # Governance cannot silently report fewer records than catalogued.
    gov_records = governance.get("records", [])
    check("governance-coverage", len(gov_records) >= len(entries), f"catalog={len(entries)} governance={len(gov_records)}", "CRITICAL")

    # Artifact inventory and cryptographic evidence.
    vault = root / "artifacts/developer-review-vault"
    encrypted = list(vault.glob("*.enc")) if vault.exists() else []
    artifact_hashes = [{"name": p.name, "sha256": sha256(p), "bytes": p.stat().st_size} for p in encrypted]
    check("encrypted-review-vault", all(x["bytes"] > 0 for x in artifact_hashes), f"encrypted artifacts={len(artifact_hashes)}", "HIGH")

    # Audit trail and backup policy must exist as code/docs, even when this run has zero acquisitions.
    check("backup-recovery-policy", (root / "docs/backup-recovery-v1.md").exists(), "recovery policy file")
    check("audit-event-engine", (root / "scripts/rechercher_audit_event.py").exists(), "append-only audit logger")
    check("ocr-verification-engine", (root / "scripts/rechercher_ocr_verify.py").exists(), "page-level OCR verifier")
    check("text-collation-engine", (root / "scripts/rechercher_text_collation.py").exists(), "non-authoritative text collation")
    check("delta-engine", (root / "scripts/rechercher_source_delta.py").exists(), "source/edition delta detector")

    # Rights are never inferred from a discovery URL or from bibliographic evidence.
    bad_rights = []
    for e in overlay_entries:
        if e.get("source_url") and e.get("rights_status") in {"discovery-only", "unknown", None}:
            bad_rights.append(e.get("id") or e.get("title"))
    check("no-rights-inference", not bad_rights, f"candidate sources lacking explicit rights: {len(bad_rights)}", "CRITICAL")

    result = {
        "schema": "developer-review-acquisition/global-control/v1",
        "generated_at": now(),
        "scope": "1-400H",
        "status": "PASS" if not gaps else "HOLD",
        "counts": {"checks": len(checks), "passed": sum(x["status"] == "PASS" for x in checks), "gaps": len(gaps), "encrypted_artifacts": len(encrypted)},
        "checks": checks,
        "gaps": gaps,
        "artifact_hashes": artifact_hashes,
        "policy": "Fail closed. Missing evidence is a gap, not permission to infer or publish.",
    }
    out = root / a.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result["counts"], ensure_ascii=False, sort_keys=True))
    # Global control is intentionally non-destructive but fail-closed for critical governance gaps.
    raise SystemExit(1 if any(g["severity"] == "CRITICAL" for g in gaps) else 0)


if __name__ == "__main__":
    main()
