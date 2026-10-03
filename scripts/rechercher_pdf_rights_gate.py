#!/usr/bin/env python3
from __future__ import annotations
import argparse, json
from pathlib import Path

PUBLIC = "verified-redistributable"
REVIEW = {"research-only", "rights-unclear"}
BLOCKED = {"restricted", "prohibited"}

def status(record):
    return record.get("rights_status") or record.get("redistribution_status") or record.get("catalog_rights_status")

def route(record):
    s = status(record)
    if s == PUBLIC:
        return "public-release"
    if s in REVIEW:
        return "developer-review-vault"
    if s in BLOCKED:
        return "metadata-only-unless-lawful-private-retention" if s == "restricted" else "blocked"
    return "developer-review-vault"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    data = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    records = (data.get("records") if isinstance(data, dict) else data) or []
    routed = []
    violations = []
    for r in records:
        s = status(r)
        target = route(r)
        item = {
            "book_id": r.get("book_id") or r.get("work_id"),
            "rights_status": s,
            "storage_class": target,
            "public_publish_allowed": target == "public-release"
        }
        routed.append(item)
        if target == "public-release":
            missing = [k for k in ("provenance", "rights_evidence", "verification_status") if not r.get(k)]
            if missing or not (r.get("sha256") or any(i.get("sha256") for i in (r.get("acquired") or []))):
                violations.append({"book_id": item["book_id"], "reason": "public-gate-metadata-incomplete", "missing": missing})
        if target != "public-release" and r.get("public_publish") is True:
            violations.append({"book_id": item["book_id"], "reason": "non-redistributable-marked-public"})
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({
        "schema": "din-allah/rechercher-pdf-rights-routing-result/v1",
        "record_count": len(records),
        "public_release_count": sum(x["storage_class"] == "public-release" for x in routed),
        "developer_review_count": sum(x["storage_class"] == "developer-review-vault" for x in routed),
        "blocked_count": sum(x["storage_class"] == "blocked" for x in routed),
        "violations": violations,
        "routes": routed
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if violations:
        raise SystemExit(f"RIGHTS_ROUTING_VIOLATIONS={len(violations)}")
    print("PDF_RIGHTS_ROUTING=VALID")
    print("PUBLIC_RELEASE_RIGHTS_GATE=ENFORCED")
    print("DEVELOPER_REVIEW_VAULT=SEPARATE")
    print("CORPUS_MUTATION=NONE")

if __name__ == "__main__":
    main()
