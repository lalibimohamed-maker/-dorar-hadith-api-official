#!/usr/bin/env python3
"""Audit the Rechercher source registries and build an explicit acquisition bridge.

The report is deliberately conservative: a source is not treated as a PDF
downloader merely because it is listed in a registry or exposes an API.
"""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    ROOT / "books-batches/salaf-01-400h/master-global-source-registry-seed-2026-09.json",
    ROOT / "config/rechercher/islamic-source-adapters-2026.json",
    ROOT / "config/rechercher/global-multilingual-resource-discovery-2026.json",
    ROOT / "config/rechercher/multilingual-resource-expansion-2026.json",
    ROOT / "config/api-activation-registry-2026.json",
]

def load(path):
    return json.loads(path.read_text(encoding="utf-8"))

def add(registry, item, origin):
    if not isinstance(item, dict):
        return
    sid = str(item.get("id") or item.get("name") or item.get("url") or "").strip()
    if not sid:
        return
    registry.setdefault(sid, {"id": sid, "origins": [], "records": []})
    registry[sid]["origins"].append(origin)
    registry[sid]["records"].append(item)

def classify(entry):
    records = entry["records"]
    blob = " ".join(json.dumps(r, ensure_ascii=False, sort_keys=True).lower() for r in records)
    explicit_acq = any(
        r.get("acquisition") in (True, "true")
        or r.get("acquisition_capability") in (True, "true")
        or "pdf" in [str(x).lower() for x in r.get("capabilities", [])]
        or "pdf-download" in [str(x).lower() for x in r.get("capabilities", [])]
        or "pdf_downloads" in [str(x).lower() for x in r.get("capabilities", [])]
        for r in records
    )
    roles = " ".join(str(r.get("role", "")) + " " + str(r.get("source_role", "")) for r in records).lower()
    kinds = set()
    for r in records:
        kinds.update(str(x).lower() for x in r.get("kinds", []) if isinstance(x, str))
    if explicit_acq or "pdf" in kinds or "book/pdf acquisition" in roles or "digital-copy/pdf acquisition" in roles:
        return "pdf_acquisition"
    if any(x in roles or x in blob for x in ("manuscript", "digital scan", "digitized manuscript", "complete scan")):
        return "digital_scan_acquisition"
    if any(x in roles or x in blob for x in ("catalogue", "bibliographic", "manuscript discovery", "provenance", "citation")):
        return "discovery_only"
    if "api" in kinds or any(r.get("runtime") in ("api_key", "public-api", "public_api", "api_in_development") for r in records):
        return "api_evidence"
    return "content_review"

def main():
    sources = {}
    for path in FILES:
        if not path.exists():
            continue
        data = load(path)
        for key in ("sources", "adapters", "connectors", "providers", "evidence_sources"):
            value = data.get(key)
            if isinstance(value, list):
                for item in value:
                    add(sources, item, str(path.relative_to(ROOT)))
    report = {
        "schema": "rechercher/source-capability-audit/v1",
        "generated_from": [str(p.relative_to(ROOT)) for p in FILES if p.exists()],
        "sources": [],
    }
    for entry in sorted(sources.values(), key=lambda x: x["id"]):
        report["sources"].append({
            "id": entry["id"],
            "class": classify(entry),
            "registry_origins": sorted(set(entry["origins"])),
            "record_count": len(entry["records"]),
            "acquisition_explicit": any(
                r.get("acquisition") in (True, "true")
                or r.get("acquisition_capability") in (True, "true")
                for r in entry["records"]
            ),
            "pdf_kind": any("pdf" in [str(x).lower() for x in r.get("kinds", [])] for r in entry["records"]),
            "rights_states": sorted(set(
                str(r.get("rights") or r.get("release_policy") or r.get("rights_policy") or "")
                for r in entry["records"]
                if r.get("rights") or r.get("release_policy") or r.get("rights_policy")
            )),
            "urls": sorted(set(
                str(r.get("base_url") or r.get("url") or "")
                for r in entry["records"]
                if r.get("base_url") or r.get("url")
            )),
        })
    counts = {}
    for row in report["sources"]:
        counts[row["class"]] = counts.get(row["class"], 0) + 1
    report["summary"] = {
        "distinct_registry_identities": len(report["sources"]),
        "by_class": counts,
        "pdf_candidates": sum(1 for x in report["sources"] if x["class"] == "pdf_acquisition"),
        "non_pdf_registry_entries": sum(1 for x in report["sources"] if x["class"] != "pdf_acquisition"),
        "policy": "A 3192-cell acquisition queue must consume this capability result instead of assuming every registry source is a downloader."
    }
    out = ROOT / "artifacts/rechercher-source-capability-audit.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
