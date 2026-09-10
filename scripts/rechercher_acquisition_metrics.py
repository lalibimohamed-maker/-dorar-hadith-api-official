#!/usr/bin/env python3
"""Persist cumulative per-book acquisition telemetry.

The downloader already records the attempts made during the current retry pass
in its audit report. This small, append-only telemetry layer carries those
numbers forward in the developer-review manifest so an unresolved title can be
explained quantitatively across runs, e.g. 7 passes / 143 source attempts /
no valid PDF.

This is observability only: it never changes acquisition decisions, rights
status, candidate URLs, or public-publishing state.
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--manifest", required=True)
    p.add_argument("--report", required=True)
    args = p.parse_args()

    manifest_path = Path(args.manifest)
    report_path = Path(args.report)
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    report = json.loads(report_path.read_text(encoding="utf-8"))
    by_id = {str(g.get("id")): g for g in report.get("gaps", []) if g.get("id") is not None}
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    for rec in data.get("records", []):
        key = str(rec.get("id"))
        gap = by_id.get(key)
        if not gap:
            continue

        m = rec.setdefault("acquisition_metrics", {})
        attempts = gap.get("attempts") or []
        source_urls = [a.get("url") for a in attempts if isinstance(a, dict) and a.get("url")]
        engines = [a.get("engine") for a in attempts if isinstance(a, dict) and a.get("engine")]

        m["schema"] = "rechercher-acquisition-metrics/v1"
        m["retry_passes"] = int(m.get("retry_passes", 0)) + 1
        m["source_attempts"] = int(m.get("source_attempts", 0)) + len(attempts)
        m["unique_sources"] = len(set(m.get("source_urls", []) or []).union(source_urls))
        m["source_urls"] = sorted(set(m.get("source_urls", []) or []).union(source_urls))
        m["successful_pdf_attempts"] = int(m.get("successful_pdf_attempts", 0)) + sum(a.get("result") == "acquired" for a in attempts if isinstance(a, dict))
        m["invalid_pdf_attempts"] = int(m.get("invalid_pdf_attempts", 0)) + sum(a.get("result") == "invalid-pdf" for a in attempts if isinstance(a, dict))
        m["error_attempts"] = int(m.get("error_attempts", 0)) + sum(a.get("result") == "error" for a in attempts if isinstance(a, dict))
        per_engine = m.setdefault("source_attempts_by_engine", {})
        for engine in engines:
            per_engine[engine] = int(per_engine.get(engine, 0)) + 1
        m["last_pass_result"] = gap.get("result", "no-match")
        m["last_pass_at"] = now
        m["last_pass_attempts"] = len(attempts)

        # Keep a compact human-readable summary for reports/UI without
        # duplicating the full audit history.
        result = "valid PDF acquired" if gap.get("result") == "acquired" else "no valid PDF"
        m["summary"] = f"{m['retry_passes']} passes → {m['source_attempts']} source attempts → {result}"

    manifest_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
